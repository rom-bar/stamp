/* Katalog mewarnai offline: 12 kategori x 10 template = 120 gambar. */
(function () {
  "use strict";

  function svg(body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220" aria-label="Gambar mewarnai" stroke="#263238" stroke-width="6" fill="#fff" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  var sets = [
    {
      name: "Hewan", slug: "hewan", emoji: ["🐱","🐶","🐰","🦁","🐘","🐢","🐵","🦋","🐟","🐧"],
      names: ["Kucing","Anjing","Kelinci","Singa","Gajah","Kura-kura","Monyet","Kupu-kupu","Ikan badut","Pinguin"],
      drawings: [
        '<circle cx="150" cy="120" r="55"/><path d="M105 82 102 45l35 25M195 82l3-37-35 25M125 120h8m34 0h8M135 145q15 12 30 0"/><path d="M95 132 55 120m150 12 40-12"/>',
        '<path d="M85 105q0-50 65-50t65 50v45q0 35-65 35t-65-35z"/><path d="M95 72 78 38l38 15m89 19 17-34-38 15M125 112h8m34 0h8M130 140q20 20 40 0M150 140v18"/><path d="M85 130H48m167 0h37"/>',
        '<path d="M100 92 85 35l45 38q20-10 40 0l45-38-15 57v50q0 35-50 35t-50-35z"/><circle cx="130" cy="120" r="5"/><circle cx="170" cy="120" r="5"/><path d="M140 145q10 8 20 0"/>',
        '<path d="M72 92 55 48l45 25q50-28 100 0l45-25-17 44v65q-10 38-78 38t-78-38z"/><path d="M120 125h10m40 0h10M135 150q15 12 30 0M150 150v18"/><path d="m95 98 12-15m98 15-12-15"/>',
        '<path d="M85 80 65 42l45 28q40-18 80 0l45-28-20 38v85q-10 35-80 35t-80-35z"/><path d="M115 120h12m46 0h12M135 150q15 12 30 0M100 155 65 165m170-10 35 10M150 166v28"/>',
        '<path d="M75 137q0-60 75-60t75 60q0 45-75 45t-75-45z"/><path d="M95 137q20-35 40 0t40 0 30 0M150 77v-30M130 48h40"/><path d="M96 182 75 205m129-23 21 23"/>',
        '<circle cx="150" cy="112" r="55"/><path d="M105 80q45-48 90 0M120 120h8m44 0h8M135 145q15 12 30 0M95 105 60 85m145 20 35-20M105 165 75 190m120-25 30 25"/>',
        '<path d="M150 45q25 25 42 48 28 38-42 91-70-53-42-91 17-23 42-48z"/><path d="M150 55v110M110 92h80M105 132h90M125 72l-20 55m70-55 20 55"/>',
        '<path d="M58 125q35-70 92-25 47-45 92 25-45 55-92 12-47 43-92-12z"/><circle cx="125" cy="112" r="5"/><circle cx="175" cy="112" r="5"/><path d="M150 100v45M100 126l-25-25m125 25 25-25"/>',
        '<path d="M115 55q35-25 70 0l15 95q-50 40-100 0z"/><path d="M115 55 95 35m90 20 20-20M120 88h60M130 115q20 15 40 0M130 160v35m40-35v35"/>'
      ]
    },
    {
      name: "Kendaraan", slug: "kendaraan", emoji: ["🚗","🚌","🚲","✈️","🚂","🚢","🚁","🚜","🛵","🚀"],
      names: ["Mobil","Bus","Sepeda","Pesawat","Kereta","Kapal","Helikopter","Traktor","Skuter","Roket"],
      drawings: [
        '<path d="M48 150 70 92h45l25-30h45l35 30h30l18 58v28H48z"/><circle cx="92" cy="178" r="20"/><circle cx="208" cy="178" r="20"/><path d="M110 92h72m-92 35h110"/>',
        '<path d="M55 55h170q20 0 20 20v105H55z"/><path d="M55 125h190M80 82h35m25 0h35m25 0h15"/><circle cx="100" cy="180" r="18"/><circle cx="200" cy="180" r="18"/>',
        '<circle cx="82" cy="158" r="35"/><circle cx="218" cy="158" r="35"/><path d="m82 158 52-65 84 65h-76l-20-45m32-20 28 0"/>',
        '<path d="M38 125q55-15 105-55 38-30 72 5l48 50h-85q-35 25-70 0H38z"/><path d="M150 90 135 45h30zm45-18 45-28m-28 70h45"/><circle cx="113" cy="125" r="7"/>',
        '<path d="M55 70h170v95H55z"/><path d="M55 105h170M85 70v95m55-95v95m55-95v95"/><circle cx="90" cy="182" r="18"/><circle cx="210" cy="182" r="18"/><path d="M35 165h230"/>',
        '<path d="M55 135q95-80 190 0v45H55z"/><path d="M90 105q60-45 120 0M150 90v60m-75 30 25 25m125-25-25 25"/><path d="M110 145h80"/>',
        '<path d="M85 130h130v35H85z"/><path d="M150 130V72m0 0q45-30 75 5-42 25-75-5zm0 0Q105 47 75 82q42 25 75-10z"/><path d="M65 165h170"/>',
        '<path d="M50 145h180v42H50z"/><path d="M80 145V90h70v55m-35-55V55m-55 90v-25m120 25v-45"/><circle cx="92" cy="188" r="16"/><circle cx="205" cy="188" r="16"/><path d="M150 55 130 40h40z"/>',
        '<path d="M95 78h90l35 55-18 55H108l-28-55z"/><circle cx="125" cy="165" r="22"/><circle cx="190" cy="165" r="22"/><path d="M115 105h60m-90 25h120"/>',
        '<path d="M150 35q42 35 42 92l-42 72-42-72q0-57 42-92z"/><path d="M150 55v95M125 95h50M110 135h80"/><path d="M108 178 75 205m117-27 33 27"/>'
      ]
    },
    {
      name: "Benda rumah", slug: "benda-rumah", emoji: ["🪑","🛏️","🛋️","⏰","💡","🧹","🪥","📺","🧺","🔑"],
      names: ["Kursi","Tempat tidur","Sofa","Jam dinding","Lampu","Sapu","Sikat gigi","Televisi","Keranjang","Kunci"],
      drawings: [
        '<path d="M75 65h150v65H75zM75 130v55m150-55v55M75 155h150"/>', '<path d="M55 85h190v80H55z"/><path d="M75 85V55h60v30m-60 50h160M75 165v30m150-30v30"/>', '<path d="M55 110q0-35 35-35h120q35 0 35 35v60H55z"/><path d="M55 135h190M95 75v60m110-60v60M75 170v25m150-25v25"/>', '<circle cx="150" cy="110" r="70"/><path d="M150 110V65m0 45 35 20M150 40v-15m-80 85H45m210 0h-25"/>', '<path d="M150 35v115M105 90h90M125 185h50"/><path d="M115 90q0-45 35-45t35 45"/>', '<path d="M95 45h25v115l-20 35h-25l20-35zM80 195h45M100 65h80l-25 75h-50z"/>', '<path d="M70 80h150v35H70zM105 115v70m90-70v70M78 80V55m144 25V55"/><path d="M80 55h140"/>', '<rect x="55" y="55" width="190" height="110" rx="8"/><path d="M75 75h150v70H75zM130 180h40"/>', '<path d="M70 80h160v100H70zM90 80V55h120v25M95 110h110M105 180l-10 25m100-25 10 25"/>', '<circle cx="140" cy="105" r="28"/><path d="M162 125q45-5 55 25-20 20-55 5l-25-25m-25-25H65v-25h47m28 25 20-35"/>'
      ]
    },
    {
      name: "Makanan", slug: "makanan", emoji: ["🍎","🍌","🍕","🍔","🍦","🍩","🥕","🍉","🍞","🎂"],
      names: ["Apel","Pisang","Pizza","Hamburger","Es krim","Donat","Wortel","Semangka","Roti","Kue ulang tahun"],
      drawings: [ '<path d="M150 65q-55 0-55 60 0 65 55 65t55-65q0-60-55-60zM150 65V40q20-20 40 0"/><path d="M150 40q-25 0-35-18"/>', '<path d="M145 45q45 20 40 75-5 70-55 65-40-5-30-55 8-42 45-85zM145 45q18-22 35-8"/>', '<path d="M150 45 65 170h170z"/><path d="m95 125 110 0M115 98l15-10m35 38 15 8m-55 20 12 5"/>', '<path d="M65 100q0-35 85-35t85 35v50H65z"/><path d="M70 105h160M80 85h140M95 130h110M75 150h150"/>', '<path d="M110 45h80v35q30 15 15 65-10 45-55 45t-55-45q-15-50 15-65z"/><path d="M110 80h80M125 45v-20m50 20v-20"/>', '<circle cx="150" cy="120" r="70"/><circle cx="150" cy="120" r="28"/><circle cx="115" cy="85" r="7"/><circle cx="190" cy="105" r="7"/><circle cx="130" cy="160" r="7"/>', '<path d="M150 40 205 175q-55 35-110 0z"/><path d="M140 65 110 180m45-120 25 105m-65-70 65 30"/>', '<path d="M55 90q95-55 190 0l-20 80H75z"/><path d="M75 90q75 45 150 0M105 80l-15 45m105-45 15 45m-80-25 40 20"/>', '<path d="M65 105q0-45 85-45t85 45v65H65z"/><path d="M65 130h170M100 95h100M100 170v25m100-25v25"/>', '<path d="M65 75h170v110H65z"/><path d="M80 75V45h140v30M65 125h170M100 95h25m50 0h25M125 155h50"/>' ]
    },
    {
      name: "Alam", slug: "alam", emoji: ["🌳","🌻","🌈","☀️","🌙","☁️","⛰️","🌵","🍁","🌊"],
      names: ["Pohon","Bunga matahari","Pelangi","Matahari","Bulan","Awan","Gunung","Kaktus","Daun","Air terjun"],
      drawings: [ '<path d="M135 105h30v95h-30zM150 115Q70 105 80 50q35-25 70 30 35-55 70-30 10 55-70 65z"/>', '<circle cx="150" cy="110" r="25"/><path d="M150 85V45m0 130v-40M125 110H85m130 0h-40M132 92l-28-28m64 28 28-28m-64 64-28 28m64-28 28 28"/><path d="M150 135v55"/>', '<path d="M45 125q25-70 55 0 25-70 50 0 25-70 50 0 30-70 55 0"/><path d="M55 125v40h190v-40"/>', '<circle cx="150" cy="110" r="55"/><path d="M150 35v-18m0 170v-18M75 110H55m190 0h-20M95 55 82 42m123 13 13-13M95 165l-13 13m123-13 13 13"/>', '<path d="M180 45q-70 15-70 85 0 65 70 65 55 0 55-55-5 30-45 15-45-20-10-55z"/>', '<path d="M60 140q25-35 60 0 30-45 65 0 35-45 60 0v40H60zM85 125q30-50 55 0 30-50 55 0"/>', '<path d="m45 185 65-100 40 55 45-75 60 120z"/><path d="m80 185 30-55 25 30 35-50 35 75"/>', '<path d="M140 190V120q-35-20-10-55 20-25 35 5 35-20 45 15 5 30-20 35v70z"/><path d="M125 145h65"/>', '<path d="M150 45q55 45 40 110-20 55-80 0-15-65 40-110z"/><path d="M150 50v130m0-85-35-25m35 65 40-28m-40 5 28-35"/>', '<path d="M55 160q40-40 80 0 40-40 80 0 25-25 35 0v35H55z"/><path d="M150 55v105m-30-75 30 30 30-30"/>' ]
    },
    {
      name: "Sekolah", slug: "sekolah", emoji: ["✏️","📚","🎒","📏","🖍️","📝","🚌","🔔","🧮","🖌️"],
      names: ["Pensil","Buku","Tas sekolah","Penggaris","Krayon","Buku tulis","Bus sekolah","Bel","Abakus","Kuas"],
      drawings: [ '<path d="m90 175 95-130 30 22-95 130z"/><path d="m90 175-25 12 0-28zM185 45l20-20 30 22-20 20zM110 145l30 22"/>', '<path d="M70 45h145v145H70zM215 65h15v125H85"/><path d="M95 75h90m-90 35h90m-90 35h60"/>', '<path d="M75 75h150v115H75zM105 75V50h90v25M115 105h70m-70 35h70"/>', '<path d="M70 65h170v55H70zM90 65v55m35-55v55m35-55v55m35-55v55"/><path d="M70 150h170"/>', '<path d="M95 40h45v145H95zM160 40h45v145h-45z"/><path d="M95 70h45m20 0h45M95 105h45m20 0h45M95 140h45m20 0h45"/>', '<path d="M70 45h160v140H70z"/><path d="M90 80h120M90 115h120M90 150h75"/><path d="M150 45v140"/>', '<path d="M55 55h190v115H55z"/><path d="M55 105h190M85 70h35m35 0h35"/><circle cx="100" cy="180" r="18"/><circle cx="200" cy="180" r="18"/>', '<path d="M90 65h120v95H90z"/><path d="M150 35v30m-35 0h70M100 160v25m100-25v25"/><circle cx="150" cy="105" r="30"/>', '<path d="M70 65h160v105H70z"/><path d="M90 105h120M90 135h120M115 65v105m35-105v105m35-105v105"/>', '<path d="M130 45h40v110h-40zM130 155l-20 40h60l-20-40z"/><path d="M130 75h40"/>' ]
    },
    {
      name: "Mainan", slug: "mainan", emoji: ["🧸","⚽","🪁","🧩","🎲","🚂","🤖","🪀","🎈","🧱"],
      names: ["Boneka beruang","Bola","Layang-layang","Puzzle","Dadu","Kereta mainan","Robot","Yoyo","Balon","Balok"],
      drawings: [ '<circle cx="150" cy="90" r="45"/><circle cx="105" cy="55" r="22"/><circle cx="195" cy="55" r="22"/><ellipse cx="150" cy="160" rx="65" ry="45"/><circle cx="130" cy="90" r="6"/><circle cx="170" cy="90" r="6"/><path d="M140 110h20"/>', '<circle cx="150" cy="110" r="70"/><path d="M95 65q30 45 110 90M205 65q-30 45-110 90M150 40v140"/>', '<path d="M150 35 65 125h170zM150 35v150m-85-60h170M85 105l65 80 65-80"/>', '<path d="M65 65h170v110H65z"/><path d="M120 65v35H90v35h40v40m30-110v35h35v35h-35v40"/>', '<rect x="80" y="55" width="140" height="140" rx="15"/><circle cx="120" cy="95" r="9"/><circle cx="175" cy="95" r="9"/><circle cx="120" cy="150" r="9"/><circle cx="175" cy="150" r="9"/>', '<path d="M60 75h180v80H60zM85 75v80m55-80v80m55-80v80"/><circle cx="95" cy="180" r="18"/><circle cx="205" cy="180" r="18"/>', '<rect x="95" y="70" width="110" height="105" rx="15"/><circle cx="125" cy="55" r="20"/><circle cx="175" cy="55" r="20"/><circle cx="130" cy="105" r="7"/><circle cx="170" cy="105" r="7"/><path d="M130 135h40M95 125H65m170 0h-30"/>', '<circle cx="150" cy="120" r="35"/><path d="M150 155v45m0-140v60M150 60q-35-15-45 15"/>', '<path d="M150 40q45 15 45 65 0 65-45 80-45-15-45-80 0-50 45-65z"/><path d="M150 185v25m-15 0h30"/>', '<rect x="65" y="105" width="70" height="70"/><rect x="135" y="65" width="70" height="70"/><rect x="165" y="135" width="70" height="70"/>' ]
    },
    {
      name: "Dunia laut", slug: "dunia-laut", emoji: ["🐙","🐳","🦀","🐚","🪸","🦈","🐬","⚓","🌊","🧜‍♀️"],
      names: ["Gurita","Paus","Kepiting","Kerang","Karang","Hiu","Lumba-lumba","Jangkar","Ombak","Putri duyung"],
      drawings: [ '<circle cx="150" cy="85" r="48"/><path d="M105 120q-35 20-20 55 15 20 30-5 10 35 30 0 15 35 30 0 20 25 30 5 15-35-20-55"/><circle cx="135" cy="80" r="6"/><circle cx="165" cy="80" r="6"/>', '<path d="M55 115q55-65 155-35l45 35-45 35q-100 30-155-35z"/><path d="M210 95q30-45 55-15-25 35-55 15zM95 95q30-20 55 0"/><circle cx="185" cy="105" r="6"/>', '<path d="M90 105q0-45 60-45t60 45v50q-60 35-120 0z"/><path d="M90 125H55m190 0h-35M115 75 85 45m100 30 30-30M115 155l-25 35m95-35 25 35"/><circle cx="130" cy="105" r="6"/><circle cx="170" cy="105" r="6"/>', '<path d="M80 150q0-80 70-110 70 30 70 110-70 45-140 0z"/><path d="M150 45v120M92 125h116M110 85q40 30 80 0"/>', '<path d="M50 180q25-45 50 0 25-45 50 0 25-45 50 0 25-45 50 0M75 175q15-80 55-30 20-65 45 0 40-50 50 30"/>', '<path d="M55 115q70-70 150-20l40 20-40 20q-80 50-150-20z"/><path d="M205 95q45-40 55 0-25 40-55 0M100 100l45 15"/><circle cx="180" cy="110" r="5"/>', '<path d="M70 120q50-75 120-15 35 30 65-10-10 65-70 45-60-30-115 0z"/><path d="M110 70q50 45 95 0"/>', '<path d="M150 40v120m0-90 45-35m-45 70 55 30M150 70l-45-35m45 80-55 30"/><path d="M125 160q25 30 50 0v30q-25 20-50 0z"/>', '<path d="M45 140q45-65 90 0 45-65 90 0 30-40 35 0v45H45z"/><path d="M80 115q30 35 60 0m20 0q30 35 60 0"/>', '<path d="M150 45q-45 20-45 70t45 55q45-5 45-55t-45-70z"/><path d="M105 160q-40 35-65 25 25-35 65-25 45 45 95 10l40 25m-90-45v-55"/>' ]
    },
    {
      name: "Luar angkasa", slug: "luar-angkasa", emoji: ["🌍","🌕","⭐","🪐","☄️","👽","🛰️","🌌","🛸","👩‍🚀"],
      names: ["Bumi","Bulan","Bintang","Planet bercincin","Komet","Makhluk luar angkasa","Satelit","Galaksi","Pesawat luar angkasa","Astronaut"],
      drawings: [ '<circle cx="150" cy="110" r="75"/><path d="M80 90q35-30 60 0 30 35 70 0m-110 55q35-25 65 0 20 20 55-5"/>', '<circle cx="150" cy="110" r="65"/><circle cx="120" cy="85" r="12"/><circle cx="180" cy="145" r="18"/><path d="M90 170 65 195m145-25 25 25"/>', '<path d="m150 30 20 55 60 5-45 38 15 58-50-32-50 32 15-58-45-38 60-5z"/>', '<circle cx="150" cy="110" r="50"/><ellipse cx="150" cy="110" rx="105" ry="25"/><circle cx="130" cy="90" r="8"/>', '<path d="M55 175q70-60 120-100 45-35 70 0-45-5-35 35 10 40-30 45 10-35-15-40-25-5-110 60z"/>', '<ellipse cx="150" cy="115" rx="55" ry="65"/><circle cx="130" cy="105" r="10"/><circle cx="170" cy="105" r="10"/><path d="M130 145q20 15 40 0M95 80 70 55m135 25 25-25"/>', '<rect x="85" y="75" width="130" height="75"/><path d="M85 95H45m170 0h40M105 75V45m90 30V45M115 150v35m70-35v35"/><circle cx="130" cy="112" r="12"/><circle cx="175" cy="112" r="12"/>', '<path d="M150 35q90 35 60 105-25 75-115 45-55-25-25-85 25-55 80-65z"/><path d="M90 75q45 25 100-5m-115 65q55 20 105-5"/>', '<path d="M65 140q0-55 85-55t85 55l-30 30H95zM110 85l-20-35m100 35 20-35m-50 35V45"/><circle cx="130" cy="120" r="8"/><circle cx="170" cy="120" r="8"/>', '<circle cx="150" cy="85" r="35"/><path d="M115 110h70l20 70H95zM115 135H80m140 0h-35M130 180v25m40-25v25"/><path d="M135 80h30"/>' ]
    },
    {
      name: "Olahraga", slug: "olahraga", emoji: ["⚽","🏀","🏸","🏓","🏆","🎾","🏊","🚴","🏹","🥋"],
      names: ["Bola sepak","Bola basket","Raket bulu tangkis","Bet tenis meja","Piala","Bola tenis","Kacamata renang","Helm sepeda","Busur panah","Sabuk karate"],
      drawings: [ '<circle cx="150" cy="110" r="70"/><path d="m150 80 25 18-10 30h-30l-10-30zM150 80V40m25 58 35 0m-45 30-20 32m-45-62 35 0m-35 0-30-25m100 87 35 25"/>', '<circle cx="150" cy="110" r="70"/><path d="M95 65q55 45 110 0M90 130q60-45 120 0M150 40v140"/>', '<path d="M75 45h25v135H75zM200 45h25v135h-25z"/><path d="M100 75h100M100 110h100M100 145h100"/>', '<path d="M70 65h160v100H70zM90 85h120v60H90zM150 85v60"/>', '<path d="M110 55h80v70h30l-10 65H90l-10-65h30z"/><path d="M110 55q0-25 40-25t40 25M115 145h70"/>', '<circle cx="150" cy="110" r="68"/><path d="M105 65q45 45 90 0m-100 85q55-45 110 0"/>', '<path d="M80 75q70-25 140 0l-15 70q-55 30-110 0z"/><path d="M105 85q45 25 90 0M110 145l-15 35m95-35 15 35"/>', '<path d="M85 70h130v70H85zM110 70V45h80v25M110 140v45m80-45v45"/><circle cx="150" cy="105" r="20"/>', '<path d="M70 170 225 55M225 55l-20 5m20-5-5 20M95 145l55 55"/><path d="M70 85q45-45 90 0-45 40-90 0zM160 85l65-30"/>', '<path d="M95 55h110l20 45-20 45H95l-20-45z"/><path d="M75 100h150M110 55v90m80-90v90"/>' ]
    },
    {
      name: "Pakaian", slug: "pakaian", emoji: ["👕","👖","👗","👟","🧢","🧤","🧦","🧣","👜","👒"],
      names: ["Baju kaus","Celana panjang","Gaun","Sepatu","Topi","Sarung tangan","Kaus kaki","Syal","Tas tangan","Topi lebar"],
      drawings: [ '<path d="M105 55 65 80l25 35 20-15v85h80v-85l20 15 25-35-40-25q-15 25-35 25t-35-25z"/>', '<path d="M105 45h90l10 65-20 90h-45l10-90-25 90H80l20-90z"/><path d="M105 45h90"/>', '<path d="M125 45h50l15 45 45 100H65l45-100zM125 45q25 20 50 0"/>', '<path d="M80 55h85v90q0 35-45 45-25 0-40-20zM165 145h60q15 30-20 45h-40z"/><path d="M80 120h85"/>', '<path d="M75 95q0-55 75-55t75 55zM105 65q45-30 90 0M75 95h150"/>', '<path d="M105 45q20-15 35 0v85q0 35-35 35zM160 45q15-15 35 0v120q-35 0-35-35z"/><path d="M105 85h30m25 0h35"/>', '<path d="M95 45h45v100l-15 55H80l15-55zM160 45h45v100l15 55h-45l-15-55z"/><path d="M95 80h45m20 0h45"/>', '<path d="M80 75q70 35 140 0v45q-70 35-140 0zM105 120l-15 75m105-75 15 75"/>', '<path d="M80 65h140v110H80zM105 65V45h90v20M80 105h140"/>', '<path d="M60 90q90-55 180 0v25H60zM95 90q55-35 110 0M100 115v20m100-20v20"/>' ]
    },
    {
      name: "Tempat sekitar", slug: "tempat-sekitar", emoji: ["🏠","🏫","🏥","🏪","⛪","🌉","🚉","🏞️","⛲","🏰"],
      names: ["Rumah","Sekolah","Rumah sakit","Toko","Tempat ibadah","Jembatan","Stasiun","Taman","Air mancur","Kastel"],
      drawings: [ '<path d="M45 105 150 35l105 70v90H45z"/><path d="M125 195v-60h50v60M75 125h35v35H75zm115 0h35v35h-35z"/>', '<path d="M50 75h200v120H50zM80 75V45h140v30M75 110h40v35H75zm110 0h40v35h-40z"/><path d="M140 145h25v50h-25z"/>', '<path d="M65 195V75h170v120zM65 75q85-50 170 0M105 110h90v55h-90z"/><path d="M135 110v55m30-55v55M150 45v30"/>', '<path d="M55 95h190v100H55zM75 95V65h150v30M80 125h35v35H80zm105 0h35v35h-35z"/><path d="M125 195v-55h50v55"/>', '<path d="M70 195V85h160v110zM70 85l80-45 80 45M115 85v-35h70v35M130 195v-65h40v65"/>', '<path d="M35 145h230M55 145l30-70h130l30 70M85 75V55m130 20V55M110 145v50m80-50v50"/>', '<path d="M55 85h190v110H55zM80 85V55h140v30M90 120h35v35H90zm85 0h35v35h-35z"/><path d="M135 195v-45h30v45"/>', '<path d="M45 190q45-60 105 0 60-60 105 0M75 170q20-50 45 0 30-55 60 0 25-50 45 0"/><path d="M150 45v80m-25-55 25-25 25 25"/>', '<ellipse cx="150" cy="175" rx="95" ry="25"/><path d="M120 175v-75h60v75M130 100q20-35 40 0M135 75h30"/>', '<path d="M65 195V80l35-35h100l35 35v115zM65 80h170M105 80v115m90-115v115M130 125h40v70h-40z"/>' ]
    }
  ];

  window.STAMP_COLORING_CATEGORIES = sets.map(function (set) {
    return {
      name: set.name,
      templates: set.names.map(function (name, index) {
        return {
          id: set.slug + "-" + (index + 1),
          name: name,
          emoji: set.emoji[index],
          svg: svg(set.drawings[index])
        };
      })
    };
  });

  // Pemeriksaan ringan saat pengembangan; tidak mengganggu pemakaian offline.
  var total = window.STAMP_COLORING_CATEGORIES.reduce(function (sum, category) { return sum + category.templates.length; }, 0);
  var ids = window.STAMP_COLORING_CATEGORIES.flatMap(function (category) { return category.templates.map(function (template) { return template.id; }); });
  if (window.STAMP_COLORING_CATEGORIES.length !== 12 || total !== 120 || new Set(ids).size !== 120) {
    throw new Error("Katalog mewarnai tidak valid: harus 12 kategori, 120 template, dan ID unik.");
  }
})();
