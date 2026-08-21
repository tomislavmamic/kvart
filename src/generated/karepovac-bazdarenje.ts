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
  "spearman": 0.1365,
  "auc": 0.5798,
  "pozadina": 1.235,
  "emisijaUgS": [
    1012.4,
    1849.3,
    2606.8
  ],
  "plohaM2": 313750,
  "pragNjuha": [
    0.7,
    7.0
  ],
  "kontrola": {
    "k2 Ozon (O3)": -0.3922,
    "k2 Ugljikov monoksid (CO)": 0.1037,
    "k2 metil+etilmerkaptan": -0.0503,
    "k1 NH3": -0.0031
  },
  "izvedbe": {
    "era5-pamti": {
      "spearman": -0.0004,
      "auc": 0.5578,
      "sati": 12858
    },
    "era5-bez": {
      "spearman": -0.0153,
      "auc": 0.544,
      "sati": 12858
    },
    "ldsp-pamti": {
      "spearman": 0.1365,
      "auc": 0.5798,
      "sati": 11247
    },
    "ldsp-bez": {
      "spearman": 0.1037,
      "auc": 0.5582,
      "sati": 11247
    },
    "spoj-pamti": {
      "spearman": -0.0694,
      "auc": 0.4905,
      "sati": 12850
    },
    "spoj-bez": {
      "spearman": -0.1061,
      "auc": 0.4533,
      "sati": 12850
    }
  }
} as const;
