// Generirano iz mjerenja postaje Karepovac 1 i modela raspršenja.
// Pokretanje: npm run bazdari-izvor — ne uređivati ručno.

export const BAZDARENJE = {
  "od": "2024-09-01",
  "do": "2026-08-17",
  "rez": "2025-09-01",
  "tvar": "H2S",
  "postaja": "k1",
  "vjetar": "spoj",
  "pamcenje": true,
  "sati": 12962,
  "spearman": 0.1071,
  "auc": 0.6129,
  "spearmanProvjera": 0.1311,
  "aucProvjera": 0.5952,
  "pozadina": 1.263,
  "emisijaUgS": [
    6410.4,
    8865.0,
    11977.7
  ],
  "plohaM2": 313750,
  "pragNjuha": [
    0.7,
    7.0
  ],
  "kontrola": {
    "k2 Ozon (O3)": -0.0829,
    "k2 Ugljikov monoksid (CO)": -0.0043,
    "k2 metil+etilmerkaptan": -0.0648,
    "k1 NH3": 0.0462
  },
  "izvedbe": {
    "era5-pamti": {
      "sati": 12978,
      "spearman": 0.097,
      "auc": 0.6154,
      "spearmanUgadjanje": 0.1181,
      "aucUgadjanje": 0.6257,
      "spearmanProvjera": 0.0661,
      "aucProvjera": 0.5873
    },
    "era5-bez": {
      "sati": 12978,
      "spearman": 0.091,
      "auc": 0.6147,
      "spearmanUgadjanje": 0.1136,
      "aucUgadjanje": 0.6249,
      "spearmanProvjera": 0.0588,
      "aucProvjera": 0.5876
    },
    "ldsp-pamti": {
      "sati": 11334,
      "spearman": 0.1612,
      "auc": 0.5974,
      "spearmanUgadjanje": 0.251,
      "aucUgadjanje": 0.633,
      "spearmanProvjera": 0.075,
      "aucProvjera": 0.5954
    },
    "ldsp-bez": {
      "sati": 11334,
      "spearman": 0.152,
      "auc": 0.5989,
      "spearmanUgadjanje": 0.2382,
      "aucUgadjanje": 0.6334,
      "spearmanProvjera": 0.0681,
      "aucProvjera": 0.5973
    },
    "spoj-pamti": {
      "sati": 12962,
      "spearman": 0.1071,
      "auc": 0.6129,
      "spearmanUgadjanje": 0.112,
      "aucUgadjanje": 0.624,
      "spearmanProvjera": 0.1311,
      "aucProvjera": 0.5952
    },
    "spoj-bez": {
      "sati": 12962,
      "spearman": 0.0809,
      "auc": 0.5969,
      "spearmanUgadjanje": 0.0814,
      "aucUgadjanje": 0.6039,
      "spearmanProvjera": 0.1063,
      "aucProvjera": 0.5866
    },
    "spoj-staro-pamti": {
      "sati": 12962,
      "spearman": -0.0581,
      "auc": 0.4912,
      "spearmanUgadjanje": -0.0802,
      "aucUgadjanje": 0.4924,
      "spearmanProvjera": -0.008,
      "aucProvjera": 0.4835
    }
  }
} as const;
