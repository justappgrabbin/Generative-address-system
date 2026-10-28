/** No network or API key. A locally supplied ES module may implement this contract.
 * It receives source-linked comparisons and returns an untested proposal.
 * The adapter does not execute generated code or mutate the substrate.
 */
export class LocalModelAdapter {
  constructor(){this.model=null;this.name=null;}
  attach(model) {
    if(!model||typeof model.ingestComparisons!=='function')throw new TypeError('Model must implement ingestComparisons({comparisons, context})');
    this.model=model;this.name=String(model.name??'Local model');
  }
  async propose(comparisons,context) {
    if(!this.model)throw new Error('No local language model attached. The swarm runs independently.');
    if(!comparisons.length)throw new Error('Run a Klein comparison first.');
    const result=await this.model.ingestComparisons({comparisons:structuredClone(comparisons),context:structuredClone(context)});
    if(!result||typeof result.text!=='string'||!result.text.trim()||result.text.length>20000)throw new TypeError('Model must return {text, evidence: [comparisonId, …]}');
    const ids=new Set(comparisons.map(c=>c.id));
    if(!Array.isArray(result.evidence)||!result.evidence.length||result.evidence.some(id=>!ids.has(id)))throw new TypeError('Model proposal must cite supplied comparison IDs');
    return {text:result.text,evidence:result.evidence};
  }
}
