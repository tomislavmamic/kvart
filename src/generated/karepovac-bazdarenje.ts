// Generirano iz mjerenja postaje Karepovac 1 i modela raspršenja.
// Pokretanje: npm run bazdari-izvor — ne uređivati ručno.

export const BAZDARENJE = {
  "od": "2024-09-01",
  "do": "2026-08-17",
  "tvar": "H2S",
  "postaja": "k1",
  "vjetar": "ldsp",
  "pamcenje": true,
  "sati": 11247,
  "spearman": 0.1345,
  "auc": 0.5771,
  "pozadina": 1.234,
  "emisijaUgS": [
    1190.2,
    2466.3,
    3707.6
  ],
  "plohaM2": 313750,
  "pragNjuha": [
    0.7,
    7.0
  ],
  "kontrola": {
    "k2 Ozon (O3)": -0.3915,
    "k2 Ugljikov monoksid (CO)": 0.1025,
    "k2 metil+etilmerkaptan": -0.0529,
    "k1 NH3": -0.0058
  },
  "izvedbe": {
    "era5-pamti": {
      "spearman": 0.0007,
      "auc": 0.5572,
      "sati": 12858
    },
    "era5-bez": {
      "spearman": -0.0122,
      "auc": 0.5455,
      "sati": 12858
    },
    "ldsp-pamti": {
      "spearman": 0.1345,
      "auc": 0.5771,
      "sati": 11247
    },
    "ldsp-bez": {
      "spearman": 0.1006,
      "auc": 0.5562,
      "sati": 11247
    },
    "spoj-pamti": {
      "spearman": -0.076,
      "auc": 0.4806,
      "sati": 12850
    },
    "spoj-bez": {
      "spearman": -0.1117,
      "auc": 0.4419,
      "sati": 12850
    }
  }
} as const;
