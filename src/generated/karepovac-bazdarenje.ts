// Generirano iz mjerenja postaje Karepovac 1 i modela raspršenja.
// Pokretanje: npm run bazdari-izvor — ne uređivati ručno.

export const BAZDARENJE = {
  "od": "2024-09-01",
  "do": "2026-08-17",
  "tvar": "H2S",
  "postaja": "k1",
  "vjetar": "ldsp",
  "pamcenje": true,
  "sati": 13791,
  "spearman": 0.0755,
  "auc": 0.5504,
  "pozadina": 1.066,
  "emisijaUgS": [
    303.6,
    1850.6,
    3263.1
  ],
  "plohaM2": 313750,
  "pragNjuha": [
    0.7,
    7.0
  ],
  "kontrola": {
    "k2 Ozon (O3)": -0.3944,
    "k2 Ugljikov monoksid (CO)": 0.0953,
    "k2 metil+etilmerkaptan": -0.0317,
    "k1 NH3": -0.0079
  },
  "izvedbe": {
    "era5-pamti": {
      "spearman": 0.011,
      "auc": 0.5523,
      "sati": 15862
    },
    "era5-bez": {
      "spearman": 0.0031,
      "auc": 0.5438,
      "sati": 15862
    },
    "visoka-pamti": {
      "spearman": -0.0239,
      "auc": 0.5163,
      "sati": 15862
    },
    "visoka-bez": {
      "spearman": -0.0472,
      "auc": 0.487,
      "sati": 15862
    },
    "ldsp-pamti": {
      "spearman": 0.0755,
      "auc": 0.5504,
      "sati": 13791
    },
    "ldsp-bez": {
      "spearman": 0.0539,
      "auc": 0.5316,
      "sati": 13791
    }
  }
} as const;
