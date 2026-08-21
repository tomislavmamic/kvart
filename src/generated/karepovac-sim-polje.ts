// Generirano iz DGU-ova LiDAR reljefa nad širim obuhvatom oko plohe.
// Opis; sama polja su u public/karepovac/sim-polje.bin, jer bi u
// base64 unutar JS-a bila 1,8 MB koje preglednik razlaže pri učitavanju.
// Pokretanje: npm run izvedi-sim-polje — ne uređivati ručno.

export const SIM_POLJE = {"gw": 256, "gh": 256, "skala": 3.06, "dubine": [25.0, 55.0, 120.0, 260.0, 600.0], "granice": {"zapad": 16.471901, "jug": 43.492703, "istok": 16.551188, "sjever": 43.550195}, "sirinaM": 6400.0, "visinaM": 6400.0, "izvor": {"lon": 16.5115446, "lat": 43.5214492}, "bajtovi": "/karepovac/sim-polje.bin", "duljina": 1376256, "odrezanoNa": 3.0} as const;
