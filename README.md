# RussHub – Russegruppe Sentral

> Komplett, responsiv webapplikasjon for norske russegrupper med roller, administratorrettigheter, invitasjonskoder, dugnadsbudsjett, planlegger og mediearkiv.

---

## 🚀 Lansering på GitHub Pages fra `main` / `docs`

Prosjektet er ferdig konfigurert slik at produksjonsfilene bygges direkte inn i mappen `/docs`, med relative stier og `.nojekyll` for full støtte under subpaths (f.eks. `https://aabakstudio.com/Russehub/`).

### 1. Bygg og push til GitHub:
```bash
# Bygg de nyeste filene inn i /docs-mappen
npm run build

# Legg til og push til main-branchen
git add .
git commit -m "Klar for GitHub Pages /docs"
git push origin main
```

### 2. Aktiver i GitHub:
1. Åpne GitHub-repositoryet ditt i nettleseren.
2. Gå til **Settings** ➔ **Pages** (i venstremenyen).
3. Under **Build and deployment**:
   - **Source**: Velg `Deploy from a branch`.
   - **Branch**: Velg `main` og mappen `/docs`.
   - Klikk **Save**.
4. Nettsiden vil nå laste inn på `https://aabakstudio.com/Russehub/` med alle stiler, skrifttyper, Firebase og funksjoner intakt!

---

## 💻 Lokal kjøring under utvikling

1. **Installer avhengigheter**:
   ```bash
   npm install
   ```

2. **Start lokal dev-server**:
   ```bash
   npm run dev
   ```
   Appen kjører på `http://localhost:3000`.

3. **Bygg for produksjon**:
   ```bash
   npm run build
   ```
   Dette oppdaterer automatisk `/docs`-mappen for GitHub Pages.

---

## 🎯 Kjernefunksjoner

- 👑 **Rollesystem & Administrator (RBAC)**:
  - **Bussjef / Administrator**: Full tilgang til å administrere gruppen, endre medlemsroller, endre dugnadsmål og fjerne medlemmer.
  - **Økonomiansvarlig**: Tilgang til føring og godkjenning av budsjettposter.
  - **Dugnadsansvarlig**: Tilgang til dugnadsvakter og salgsmål.
  - **Medlem**: Tilgang til planlegger, oppslagstavle og felles mediearkiv.
- 🔑 **Opprett gruppe & Invitasjonskode**:
  - Hver russegruppe får en unik invitasjonskode (f.eks. `KRON-2026`).
  - Nye medlemmer kan enkelt bli med via knappen **«Bli med i gruppe»** ved å lime inn koden.
  - 1-klikks kopiering av invitasjonskoden for deling på Snapchat/SMS.
- 📅 **Planlegger & Kalender**:
  - Oversikt over møter, dugnader, rullinger, slippfester og viktige tidsfrister.
- 💰 **Budsjett & Dugnadskasse**:
  - Sanntidssaldo i NOK, oversikt over inntekter (dugnad/spons) og utgifter (buss, lyd, klær), med målstrek.
- 📁 **Mediearkiv & Kontrakter**:
  - Opplasting og visning av kontrakter, logo- og konseptskisser og kvitteringer med fullskjerms lightbox.
- 📌 **Oppslagstavle**:
  - Viktige beskjeder fra sjefene med festing øverst (*PIN*).
- 🌓 **Tema-velger**:
  - Skift mellom mørkt russetema og minimalistisk lyst tema.
