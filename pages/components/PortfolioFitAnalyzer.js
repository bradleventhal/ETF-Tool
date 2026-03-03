import React, { useState } from 'react';

const mappings = {
  SGOV: 'UYLD/AOUIX',
  SHV: 'UYLD/AOUIX',
  BIL: 'UYLD/AOUIX',
  PTTRX: 'CARY',
  BOND: 'CARY',
  AGG: 'ANGIX',
  BND: 'ANGIX',
  HYG: 'AOHY',
  JNK: 'AOHY',
  MBB: 'MBS ETF',
  VMBS: 'MBS ETF',
  MINT: 'UYLD',
  JPST: 'UYLD'
};

const PortfolioFitAnalyzer = () => {
  const [ticker, setTicker] = useState('');
  const [replacement, setReplacement] = useState('');

  const handleAnalyze = () => {
    const replace = mappings[ticker.toUpperCase()];
    if (replace) {
      setReplacement(`Suggested Angel Oak Replacement: ${replace}`);
    } else {
      setReplacement('No replacement found.');
    }
  };

  return (
    <div>
      <h1>Portfolio Fit Analyzer</h1>
      <input
        type="text"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Enter ticker"
      />
      <button onClick={handleAnalyze}>Analyze</button>
      {replacement && <p>{replacement}</p>}
    </div>
  );
};

export default PortfolioFitAnalyzer;