# RussHub – Russegruppe Sentral

> Komplett, responsiv webapplikasjon for norske russegrupper med roller, administratorrettigheter, invitasjonskoder, dugnadsbudsjett, planlegger og mediearkiv.

![RussHub](https://img.shields.io/badge/Russetid-2026-e02438.svg)
![Status](https://img.shields.io/badge/Deploy-GitHub%20Pages-success.svg)
![Firebase](https://img.shields.io/badge/Backend-Firebase%20v9-orange.svg)

---

## ⚡ Rask oppstart (Lokal kjøring)

1. **Klon repoet**:
   ```bash
   git clone https://github.com/<ditt-brukernavn>/<ditt-repo>.git
   cd <ditt-repo>
   ```

2. **Installer avhengigheter**:
   ```bash
   npm install
   ```

3. **Start utviklingsserver**:
   ```bash
   npm run dev
   ```
   Åpne `http://localhost:3000` i nettleseren din.

4. **Bygg for produksjon**:
   ```bash
   npm run build
   npm run preview
   ```

---

## 🚀 Publisering på GitHub Pages

Dette prosjektet er optimalisert for GitHub Pages:

1. Push koden til ditt GitHub-repository:
   ```bash
   git add .
   git commit -m "Optimalisert for GitHub Pages"
   git push origin main
   ```
2. Gå til repositoryet ditt på GitHub: **Settings** -> **Pages**.
3. Under **Build and deployment** / **Source**: Velg **GitHub Actions**.
4. GitHub Actions vil automatisk bygge prosjektet og rulle ut til `https://<ditt-brukernavn>.github.io/<ditt-repo>/`.
5. *(Alternativt)*: Du kan bygge lokalt med `npm run build` og publisere `dist/`-mappen direkte.

---

## 🎯 Kjernefunksjoner

- 👑 **Rollesystem & Administrator (RBAC)**:
  - **Bussjef / Administrator**: Full tilgang til å administrere gruppen, endre medlemsroller, endre dugnadsmål og fjerne medlemmer.
  - **Økonomiansvarlig**: Tilgang til føring og godkjenning av budsjettposter.
  - **Dugnadsansvarlig**: Tilgang til dugnadsvakter og frister.
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

---

## 🛠️ Teknologistakk

- **Frontend**: Vanilla HTML5, CSS3 (responsiv CSS Grid/Flexbox), Vanilla JavaScript (ES6+ Modules).
- **Backend**: Firebase Auth (Google Sign-In), Cloud Firestore, Firebase Storage.
- **Byggverktøy**: Vite med relativ sti-støtte (`base: './'`) for full kompatibilitet med GitHub Pages og statisk hosting.
