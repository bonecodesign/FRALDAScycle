import {millisecondsUntilDailyRetention} from '../../workers/exchange-reconciliation-retention.js';

export function createExchangeRetentionStatusService(repository,{clock=()=>new Date()}={}){return Object.freeze({
 async snapshot(){const now=new Date(clock()),[stored,rows]=await Promise.all([repository.status(),repository.history()]),nextRunAt=new Date(now.getTime()+millisecondsUntilDailyRetention(now)).toISOString(),history=rows.slice(0,30).map(row=>Object.freeze({ranAt:row.ran_at,result:row.result,anonymizedCount:Number(row.anonymized_count)}));return Object.freeze({state:stored?.consecutive_failures?'attention':stored?.last_status==='success'?'healthy':stored?.last_status==='failed'?'attention':'awaiting_first_run',lastRunAt:stored?.last_run_at??null,nextRunAt,consecutiveFailures:Number(stored?.consecutive_failures??0),notifiedAccessLevel:stored?.highest_notified_level==null?null:Number(stored.highest_notified_level),lastAnonymizedCount:Number(stored?.last_anonymized_count??0),history,sensitiveDataIncluded:false});}
});}

