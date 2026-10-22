import { effectivePriceCeiling, productEconomyBasisPoints } from '../packages/contracts/monthly-pricing-rules.js';

const protectedTransactionStatuses = ['reserved','payment_pending','paid','in_delivery','donation_confirmed','disputed'];

export function createMonthlyPricingRepository(database) {
  return Object.freeze({
    async saveReference({ referenceKey, validFrom, validUntil, prmCents, lowestRetailCents, collectedAt, metadata = {} }) {
      const ceilingCents = effectivePriceCeiling({ prmCents, lowestRetailCents });
      const result = await database.query(`INSERT INTO market_price_reference_cycles
        (reference_key,valid_from,valid_until,prm_cents,lowest_retail_cents,effective_ceiling_cents,collected_at,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        ON CONFLICT(reference_key,valid_from) DO UPDATE SET
          valid_until=EXCLUDED.valid_until,prm_cents=EXCLUDED.prm_cents,
          lowest_retail_cents=EXCLUDED.lowest_retail_cents,effective_ceiling_cents=EXCLUDED.effective_ceiling_cents,
          collected_at=EXCLUDED.collected_at,metadata=EXCLUDED.metadata,status='active'
        RETURNING *`, [referenceKey,validFrom,validUntil,prmCents,lowestRetailCents,ceilingCents,collectedAt,JSON.stringify(metadata)]);
      return result.rows[0];
    },

    async reconcileReference({ referenceKey, validFrom }) {
      return database.transaction(async client => {
        const reference=(await client.query(`SELECT * FROM market_price_reference_cycles
          WHERE reference_key=$1 AND valid_from=$2 AND status IN('active','extended') FOR UPDATE`,[referenceKey,validFrom])).rows[0];
        if(!reference) return { checked:0, paused:0, protected:0, listingIds:[] };

        const rows=(await client.query(`SELECT l.id,l.seller_id,l.price_cents,l.status,l.expires_at
          FROM listings l
          WHERE l.kind='sale' AND l.status='published' AND l.price_cents IS NOT NULL
            AND COALESCE(l.metadata->>'referenceKey','')=$1
            AND (l.expires_at IS NULL OR l.expires_at>now())
          FOR UPDATE OF l`,[referenceKey])).rows;

        let paused=0, protectedCount=0;
        const listingIds=[];
        for(const listing of rows){
          if(listing.price_cents<=reference.effective_ceiling_cents) continue;
          const active=(await client.query(`SELECT 1 FROM transactions WHERE listing_id=$1
            AND status=ANY($2::transaction_status[]) LIMIT 1`,[listing.id,protectedTransactionStatuses])).rowCount>0;
          if(active){ protectedCount++; continue; }
          const economy=productEconomyBasisPoints({prmCents:reference.prm_cents,listingPriceCents:listing.price_cents});
          await client.query(`UPDATE listings SET status='paused',pause_reason='price_adjustment_required',updated_at=now()
            WHERE id=$1 AND status='published'`,[listing.id]);
          await client.query(`INSERT INTO listing_price_history
            (listing_id,reference_cycle_id,previous_price_cents,new_price_cents,prm_cents,lowest_retail_cents,economy_basis_points,reason)
            VALUES($1,$2,$3,$3,$4,$5,$6,'monthly_reference_revalidation')`,
            [listing.id,reference.id,listing.price_cents,reference.prm_cents,reference.lowest_retail_cents,economy]);
          await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
            VALUES(NULL,'listing.price_adjustment_required','listing',$1,$2::jsonb)`,
            [listing.id,JSON.stringify({referenceCycleId:reference.id,ceilingCents:reference.effective_ceiling_cents})]);
          paused++; listingIds.push(listing.id);
        }
        return { checked:rows.length, paused, protected:protectedCount, listingIds };
      });
    },
  });
}
