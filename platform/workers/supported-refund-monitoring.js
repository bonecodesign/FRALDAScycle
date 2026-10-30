export async function monitorSupportedRefunds({repository,thresholdMinutes=120,limit=50}){
  if(!Number.isInteger(thresholdMinutes)||thresholdMinutes<15||thresholdMinutes>10080)throw new Error('O prazo de alerta deve ficar entre 15 minutos e 7 dias.');
  return repository.flagOverdueSupportedRefunds({thresholdMinutes,limit});
}
