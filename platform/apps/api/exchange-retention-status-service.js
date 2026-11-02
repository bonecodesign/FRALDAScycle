import {millisecondsUntilDailyRetention} from '../../workers/exchange-reconciliation-retention.js';

export function createExchangeRetentionStatusService(repository,{clock=()=>new Date()}={}){return Object.freeze({
 async snapshot(){const now=new Date(clock()),stored=await repository.status(),nextRunAt=new Date(now.getTime()+millisecondsUntilDailyRetention(now)).toISOString();return Object.freeze({state:stored?.consecutive_failures?'attention':stored?.last_status==='success'?'healthy':stored?.last_status==='failed'?'attention':'awaiting_first_run',lastRunAt:stored?.last_run_at??null,nextRunAt,consecutiveFailures:Number(stored?.consecutive_failures??0),notifiedAccessLevel:stored?.highest_notified_level==null?null:Number(stored.highest_notified_level),lastAnonymizedCount:Number(stored?.last_anonymized_count??0),sensitiveDataIncluded:false});}
});}

