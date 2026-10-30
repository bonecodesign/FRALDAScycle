export function createCourierQuoteRepository(database) {
  return Object.freeze({
    async rankEligible({ senderId, recipientId, recipientLatitude, recipientLongitude, now }) {
      const result = await database.query(`SELECT p.user_id AS courier_id,
        6371 * 2 * asin(sqrt(
          power(sin(radians(a.latitude-$2::numeric)/2),2) +
          cos(radians($2::numeric))*cos(radians(a.latitude))*
          power(sin(radians(a.longitude-$3::numeric)/2),2)
        )) AS distance_to_recipient_km
        FROM courier_current_availability a
        JOIN courier_profiles p ON p.user_id=a.courier_id
        JOIN users u ON u.id=p.user_id
        WHERE a.available=true AND a.location_consent_version='FC-COURIER-LOCATION-1'
          AND a.location_verified_at>$4::timestamptz-interval '5 minutes'
          AND p.user_id<>ALL($1::uuid[]) AND u.role='courier' AND u.disabled_at IS NULL
          AND p.account_status='active' AND p.identity_status='verified'
          AND p.adult_confirmed_at IS NOT NULL AND p.email_verified_at IS NOT NULL
          AND p.phone_verified_at IS NOT NULL AND p.payout_status='verified'
          AND p.terms_version='FC-COURIER-1' AND p.terms_accepted_at IS NOT NULL
          AND p.admin_approval_status='approved'
          AND EXISTS(SELECT 1 FROM courier_vehicles v WHERE v.courier_id=p.user_id
            AND v.status='approved' AND (v.vehicle_type='bicycle' OR
              (v.driver_license_status='verified' AND v.driver_license_expires_at>$4)))
          AND EXISTS(SELECT 1 FROM courier_clearance_documents d WHERE d.courier_id=p.user_id
            AND d.status='verified' AND d.expires_at>$4)
          AND NOT EXISTS(SELECT 1 FROM courier_clearance_suspensions s
            WHERE s.courier_id=p.user_id AND s.status='suspended')
        ORDER BY distance_to_recipient_km,p.user_id LIMIT 3`,
      [[senderId, recipientId], recipientLatitude, recipientLongitude, now]);
      return result.rows.map((row,index)=>({courierId:row.courier_id,priority:index+1,
        distanceToRecipientKm:Number(row.distance_to_recipient_km)}));
    },
  });
}
