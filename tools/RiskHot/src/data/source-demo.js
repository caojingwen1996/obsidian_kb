// 信源原型的独立演示配置；不代表真实准入、接入状态或使用关系。
// 六维独立维护，不依据正文、优先级或等级推导其他维度。
window.RISK_HOT_SOURCE_DEMO = {
 overrides: {
  'wiki-source-001':{dims:['QUANTITY','PRICE','FLOW'],levels:['MACRO'],priority:'CORE',frequency:'MONTHLY',functions:['POLICY','RAW_DATA']},
  'wiki-source-002':{dims:['QUANTITY'],levels:['MACRO'],priority:'CORE',frequency:'MONTHLY',functions:['POLICY','RAW_DATA']},
  'wiki-source-004':{dims:['FLOW'],levels:['MACRO'],priority:'HIGH',frequency:'MONTHLY',functions:['RAW_DATA']},
  'wiki-source-005':{dims:['PRICE','FLOW'],levels:['MESO'],priority:'HIGH',frequency:'DAILY',functions:['RAW_DATA']},
  'wiki-source-018':{dims:['QUANTITY'],levels:['MACRO'],priority:'CORE',frequency:'MONTHLY',functions:['RAW_DATA']},
  'wiki-source-027':{dims:[],levels:['MICRO'],priority:'HIGH',frequency:'IRREGULAR',functions:['RAW_DATA','EVENT']},
  'wiki-source-028':{publisher:'中国人民银行',dims:['QUANTITY','PRICE'],levels:['MACRO'],priority:'HIGH',frequency:'IRREGULAR',functions:['POLICY']},
  'wiki-source-033':{dims:[],levels:['MACRO','MESO','MICRO'],priority:'NORMAL',frequency:'IRREGULAR',functions:['ANALYSIS']},
  'wiki-source-040':{dims:['QUANTITY','PRICE'],levels:['MACRO'],priority:'NORMAL',frequency:'IRREGULAR',functions:['RAW_DATA']}
 },
 presets: {
  'wiki-source-018':['demo-source-1','DEMO_NBS_MACRO','ACTIVE','auto',false],
  'wiki-source-001':['demo-source-2','DEMO_PBC_POLICY','DISABLED','manual',false],
  'wiki-source-033':['demo-source-3','DEMO_RESEARCH','DISABLED','manual',false],
  'wiki-source-005':['demo-source-4','DEMO_MONEY','ACTIVE','auto',true]
 },
 relations: {
  'wiki-source-018':{indicators:[{name:'宏观统计观察指标（示例）',id:'DEMO-IND-01',version:1}],materials:[{name:'统计公报样本（示例）',id:'DEMO-DOC-01',version:1}]}
 }
};
