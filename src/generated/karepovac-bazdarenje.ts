// Generirano iz mjerenja postaje Karepovac 1 i modela raspršenja.
// Pokretanje: npm run bazdari-izvor — ne uređivati ručno.

export const BAZDARENJE = {
  "od": "2024-09-01",
  "do": "2026-08-17",
  "tvar": "H2S",
  "postaja": "k1",
  "vjetar": "ldsp",
  "pamcenje": true,
  "sati": 11334,
  "spearman": 0.128,
  "auc": 0.5733,
  "pozadina": 1.247,
  "emisijaUgS": [
    811.4,
    1822.3,
    2776.8
  ],
  "plohaM2": 313750,
  "pragNjuha": [
    0.7,
    7.0
  ],
  "kontrola": {
    "k2 Ozon (O3)": -0.3887,
    "k2 Ugljikov monoksid (CO)": 0.0924,
    "k2 metil+etilmerkaptan": -0.0553,
    "k1 NH3": -0.0155
  },
  "izvedbe": {
    "era5-pamti": {
      "spearman": -0.0089,
      "auc": 0.5445,
      "sati": 12954
    },
    "era5-bez": {
      "spearman": -0.0217,
      "auc": 0.5317,
      "sati": 12954
    },
    "ldsp-pamti": {
      "spearman": 0.128,
      "auc": 0.5733,
      "sati": 11334
    },
    "ldsp-bez": {
      "spearman": 0.098,
      "auc": 0.5556,
      "sati": 11334
    },
    "spoj-pamti": {
      "spearman": -0.0653,
      "auc": 0.4873,
      "sati": 12946
    },
    "spoj-bez": {
      "spearman": -0.0985,
      "auc": 0.454,
      "sati": 12946
    }
  }
} as const;
