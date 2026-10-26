export function createClient(fetcher=globalThis.fetch.bind(globalThis)) {
  const command=(url,method,body)=>Object.freeze({url,method,key:crypto.randomUUID(),body:JSON.stringify(body)});
  async function request(url,options,submitted) {
    let response;
    try {response=await fetcher(url,{credentials:'same-origin',cache:'no-store',...options,signal:AbortSignal.timeout(25_000)});}
    catch {throw Object.assign(new Error('Request unavailable'),{code:submitted?'OUTCOME_UNKNOWN':'CONNECTION_UNAVAILABLE',command:submitted});}
    let value;
    try {value=response.status===204?null:await response.json();}
    catch {throw Object.assign(new Error('Response unavailable'),{code:submitted?'OUTCOME_UNKNOWN':'RESPONSE_INVALID',status:response.status,command:submitted});}
    if(!response.ok)throw Object.assign(new Error('Request rejected'),{code:value?.error?.code || 'REQUEST_FAILED',status:response.status,command:response.status>=500?submitted:undefined});
    return value;
  }
  return {command,get:url=>request(url,{method:'GET'}),send:input=>request(input.url,{method:input.method,headers:{'Content-Type':'application/json','Idempotency-Key':input.key},body:input.body},input)};
}
