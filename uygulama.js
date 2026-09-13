/* Kasa — tek sayfa.
   Bir rakam (teslim edilen kasa), iki marka, son teslimler. Başka ekran yok. */

const SB_URL = 'https://cuujupeindodpsdjcivm.supabase.co';
const SB_KEY = 'sb_publishable_8VUf7LlsIZGxAv1qOhOhYA_eAJD-4oe';
const sb = supabase.createClient(SB_URL, SB_KEY);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const D = { donem: 'ay', defterler: [], markalar: [] };

const TL = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ISARET = { TRY: '₺', USD: '$', EUR: '€' };
const para = (n, pb) => TL.format(Number(n) || 0) + ' ' + (ISARET[pb] || ISARET.TRY);
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const KISA  = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const iso = (d) => d.toISOString().slice(0, 10);
const kacak = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function aralik() {
  const s = new Date();
  if (D.donem === 'gun') return [iso(s), iso(s)];
  if (D.donem === 'hafta') {
    const b = new Date(s); b.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    const t = new Date(b); t.setDate(b.getDate() + 6);
    return [iso(b), iso(t)];
  }
  if (D.donem === 'yil') return [s.getFullYear() + '-01-01', s.getFullYear() + '-12-31'];
  return [iso(new Date(s.getFullYear(), s.getMonth(), 1)),
          iso(new Date(s.getFullYear(), s.getMonth() + 1, 0))];
}
const donemAdi = () => ({
  gun: 'Bugün', hafta: 'Bu hafta',
  ay: AYLAR[new Date().getMonth()] + ' ayı', yil: new Date().getFullYear() + ' yılı',
}[D.donem]);

/* ---------- giriş ---------- */
$('#girisDugme').onclick = async () => {
  const e = $('#ePosta').value.trim(), p = $('#parola').value;
  $('#girisHata').textContent = '';
  if (!e || !p) { $('#girisHata').textContent = 'E-posta ve parola gerekli.'; return; }
  const d = $('#girisDugme');
  d.disabled = true; d.textContent = 'Giriş yapılıyor…';
  const { error } = await sb.auth.signInWithPassword({ email: e, password: p });
  d.disabled = false; d.textContent = 'Giriş yap';
  if (error) { $('#girisHata').textContent = 'E-posta veya parola hatalı.'; return; }
  basla();
};
$('#parola').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') $('#girisDugme').click();
});

/* ---------- veri ---------- */
async function basla() {
  $('#giris').classList.add('gizli');
  $('#uygulama').classList.remove('gizli');
  $('#yenile').onclick = yenile;
  await yukle();
}

async function yukle() {
  const [d, m] = await Promise.all([
    sb.from('kasa_defterler').select('ad,simge,sira,para_birimi').eq('arsiv', false).order('sira'),
    sb.from('kasa_marka_ozet')
      .select('marka,tarih,tahsilat,teslim_alinan,teslim_bekleyen,teslim_reddedilen,guncellendi')
      .order('tarih', { ascending: false }).limit(900),
  ]);
  if (d.error) {
    $('#icerik').innerHTML =
      '<div class="bos-durum"><b>Veri okunamadı</b>' + kacak(d.error.message) + '</div>';
    return;
  }
  D.defterler = d.data || [];
  D.markalar = m.data || [];
  ciz();
}

/* ---------- tek ekran ---------- */
function ciz() {
  const [bas, bit] = aralik();

  const markalar = D.defterler.map((d) => {
    const hepsi = D.markalar.filter((m) => m.marka === d.ad);
    const donem = hepsi.filter((m) => m.tarih >= bas && m.tarih <= bit);
    return {
      ad: d.ad,
      simge: d.simge || '📦',
      pb: d.para_birimi || 'TRY',
      bagli: hepsi.length > 0,
      teslim: donem.reduce((a, m) => a + Number(m.teslim_alinan || 0), 0),
      bekleyen: donem.reduce((a, m) => a + Number(m.teslim_bekleyen || 0), 0),
      reddedilen: donem.reduce((a, m) => a + Number(m.teslim_reddedilen || 0), 0),
      tahsilat: donem.reduce((a, m) => a + Number(m.tahsilat || 0), 0),
      adet: donem.filter((m) => Number(m.teslim_alinan || 0) > 0).length,
    };
  });

  // HENUZ TESLIM EDILMEMIS: tahsil edilmis ama hicbir teslim kaydina girmemis para.
  // Eksi cikarsa gostermeyiz -- donem sinirinda onceki donemin parasi teslim
  // edilmis demektir, bilgi degil gurultu olur.
  for (const m of markalar) {
    m.girilmemis = Math.max(0,
      m.tahsilat - (m.teslim + m.bekleyen + m.reddedilen));
  }

  // Para birimleri farkli olabilir; birbirine eklenmez, ayri ayri toplanir.
  const toplamlar = {};
  const bekleyenler = {};
  const reddedilenler = {};
  const girilmemisler = {};
  for (const m of markalar) {
    if (!m.bagli) continue;
    toplamlar[m.pb] = (toplamlar[m.pb] || 0) + m.teslim;
    bekleyenler[m.pb] = (bekleyenler[m.pb] || 0) + m.bekleyen;
    reddedilenler[m.pb] = (reddedilenler[m.pb] || 0) + m.reddedilen;
    girilmemisler[m.pb] = (girilmemisler[m.pb] || 0) + m.girilmemis;
  }
  const birimler = Object.keys(toplamlar);

  const gunler = D.markalar
    .filter((m) => m.tarih >= bas && m.tarih <= bit && Number(m.teslim_alinan || 0) > 0)
    .sort((a, b) => a.tarih < b.tarih ? 1 : -1);

  const guncel = D.markalar.reduce(
    (en, m) => (!en || m.guncellendi > en) ? m.guncellendi : en, null);

  let h = '';

  h += '<div class="donem">' + [
    ['gun', 'Gün'], ['hafta', 'Hafta'], ['ay', 'Ay'], ['yil', 'Yıl'],
  ].map((p) => '<button data-donem="' + p[0] + '"' +
    (D.donem === p[0] ? ' class="aktif"' : '') + '>' + p[1] + '</button>').join('') + '</div>';

  h += '<div class="hero">' +
    '<div class="etiket">Teslim edilen kasa</div>' +
    (birimler.length
      ? birimler.map((b) =>
          '<div class="rakam sayi' + (toplamlar[b] > 0 ? '' : ' bos') + '">' +
          para(toplamlar[b], b) + '</div>').join('')
      : '<div class="rakam sayi bos">' + para(0, 'TRY') + '</div>') +
    '<div class="alt">' + donemAdi() + '</div>' +
    birimler.filter((b) => girilmemisler[b] > 0).map((b) =>
      '<div class="acik sayi">⏳ teslim edilmemiş ' + para(girilmemisler[b], b) +
      '</div>').join('') +
    birimler.filter((b) => bekleyenler[b] > 0).map((b) =>
      '<div class="zil sayi">🔔 onay bekleyen ' + para(bekleyenler[b], b) + '</div>').join('') +
    birimler.filter((b) => reddedilenler[b] > 0).map((b) =>
      '<div class="red sayi">↩︎ reddedilen ' + para(reddedilenler[b], b) +
      ' · yeniden girilmeli</div>').join('') +
  '</div>';

  h += '<div class="markalar">' + markalar.map((m) =>
    '<div class="marka">' +
      '<div class="ikon">' + m.simge + '</div>' +
      '<div class="ad">' + kacak(m.ad) + '</div>' +
      '<div class="tutar sayi' + (m.bagli && m.teslim > 0 ? '' : ' bos') + '">' +
        (m.bagli ? para(m.teslim, m.pb) : '—') + '</div>' +
      '<div class="not">' + (m.bagli
        ? (m.adet ? m.adet + ' teslim' : 'teslim yok')
        : 'henüz bağlanmadı') + '</div>' +
      (m.reddedilen > 0
        ? '<div class="not red sayi">↩︎ ' + para(m.reddedilen, m.pb) + ' reddedildi</div>'
        : '') +
    '</div>').join('') + '</div>';

  if (gunler.length) {
    h += '<div class="baslik"><span>Son teslimler</span><span>' +
         gunler.length + ' kayıt</span></div>';
    h += '<div class="liste">' + gunler.map((g) => {
      const t = new Date(g.tarih + 'T00:00');
      const d = D.defterler.find((x) => x.ad === g.marka);
      return '<div class="satir">' +
        '<div class="ikon">' + ((d && d.simge) || '📦') + '</div>' +
        '<div class="orta">' +
          '<div class="gun">' + t.getDate() + ' ' + AYLAR[t.getMonth()] + '</div>' +
          '<div class="haf">' + KISA[t.getDay()] + ' · ' + kacak(g.marka) + '</div>' +
        '</div>' +
        '<div class="tut sayi">' +
          para(g.teslim_alinan, (d && d.para_birimi) || 'TRY') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  } else {
    h += '<div class="bos-durum"><b>' + donemAdi() + ' teslim yok</b>' +
         'Bu dönemde kasaya teslim edilmiş para görünmüyor.</div>';
  }

  h += '<div class="dip">' +
    (guncel ? 'Son güncelleme ' + new Date(guncel).toLocaleString('tr-TR',
      { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '') +
    '<br><button id="cikis">Çıkış yap</button>' +
  '</div>';

  $('#icerik').innerHTML = h;

  $$('[data-donem]').forEach((b) => {
    b.onclick = () => { D.donem = b.dataset.donem; ciz(); };
  });
  $('#cikis').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

/* ---------- yenile ---------- */
async function yenile() {
  const y = $('#yenile');
  y.textContent = '…'; y.disabled = true;
  try {
    const { data, error } = await sb.functions.invoke('marka-ozet');
    if (error) throw error;
    if (data && data.durum === 'hata') alert('Yenilenemedi:\n' + data.mesaj);
    else if (data && data.medicamine && data.medicamine.atlandi)
      alert('Bir marka güncellendi.\n\nDiğeri için gizli anahtar henüz tanımlı değil.');
  } catch (e) {
    alert('Yenilenemedi: ' + (e.message || e));
  }
  y.textContent = '↻'; y.disabled = false;
  await yukle();
}

sb.auth.getSession().then(({ data }) => { if (data.session) basla(); });
