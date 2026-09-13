/* Kasa — teslim edilen paranın tek yeri
   İki ekran: KASA (iki markanın teslim toplamı) ve MARKA (o markanın teslim
   geçmişi). Elle tutulan defter menüye alındı; ana akışı kalabalıklaştırmıyor. */

const SB_URL = 'https://cuujupeindodpsdjcivm.supabase.co';
const SB_KEY = 'sb_publishable_8VUf7LlsIZGxAv1qOhOhYA_eAJD-4oe';
const sb = supabase.createClient(SB_URL, SB_KEY);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const D = {
  gorunum: 'kasa',      // kasa | marka | defter
  donem: 'ay',
  defterler: [], defter: null,
  markalar: [],
  hesaplar: [], kategoriler: [], islemler: [],
  eposta: '',
};

/* ---------- biçimlendirme ---------- */
const TL = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const para = (n) => TL.format(Number(n) || 0) + ' ₺';
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const GUNLER = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const iso = (d) => d.toISOString().slice(0, 10);
const bugun = () => iso(new Date());
const kacak = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function donemAraligi() {
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
  ay: AYLAR[new Date().getMonth()], yil: String(new Date().getFullYear()),
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

/* ---------- açılış ---------- */
async function basla() {
  $('#giris').classList.add('gizli');
  $('#uygulama').classList.remove('gizli');
  const { data: o } = await sb.auth.getUser();
  D.eposta = (o && o.user && o.user.email) || '';
  await veriYukle();
}

async function veriYukle() {
  $('#icerik').innerHTML = '<div class="yukleniyor">Yükleniyor…</div>';
  const [d, m] = await Promise.all([
    sb.from('kasa_defterler').select('*').eq('arsiv', false).order('sira'),
    sb.from('kasa_marka_ozet').select('*').order('tarih', { ascending: false }).limit(900),
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

async function defterVerisi() {
  const [h, k, i] = await Promise.all([
    sb.rpc('kasa_hesap_bakiyeleri', { p_defter: D.defter.id }),
    sb.from('kasa_kategoriler').select('*').eq('defter_id', D.defter.id).order('sira'),
    sb.from('kasa_islemler').select('*').eq('defter_id', D.defter.id)
      .eq('silindi', false).order('tarih', { ascending: false }).limit(300),
  ]);
  D.hesaplar = h.data || [];
  D.kategoriler = k.data || [];
  D.islemler = i.data || [];
}

/* ---------- marka hesapları ---------- */
function markaOzeti(ad) {
  const [bas, bit] = donemAraligi();
  const tum = D.markalar.filter((m) => m.marka === ad)
                        .sort((a, b) => a.tarih < b.tarih ? -1 : 1);
  const donem = tum.filter((m) => m.tarih >= bas && m.tarih <= bit);
  const gunler = donem.filter((m) => Number(m.teslim_alinan || 0) > 0)
                      .sort((a, b) => a.tarih < b.tarih ? 1 : -1);
  const son = tum[tum.length - 1];
  return {
    ad,
    varMi: tum.length > 0,
    teslim: donem.reduce((a, m) => a + Number(m.teslim_alinan || 0), 0),
    bekleyen: donem.reduce((a, m) => a + Number(m.teslim_bekleyen || 0), 0),
    gunler,
    guncel: son && son.guncellendi,
  };
}

/* ---------- ortak parçalar ---------- */
function donemSecici() {
  return '<div class="donem">' + [
    ['gun', 'Gün'], ['hafta', 'Hafta'], ['ay', 'Ay'], ['yil', 'Yıl'],
  ].map((p) =>
    '<button data-donem="' + p[0] + '"' +
    (D.donem === p[0] ? ' class="aktif"' : '') + '>' + p[1] + '</button>'
  ).join('') + '</div>';
}

function hero(etiket, tutar, bekleyen, not) {
  return '<div class="hero">' +
    '<div class="etiket">' + etiket + '</div>' +
    '<div class="donemAdi">' + donemAdi() + '</div>' +
    '<div class="rakam sayi' + (Number(tutar) > 0 ? '' : ' bos') + '">' + para(tutar) + '</div>' +
    (Number(bekleyen) > 0
      ? '<div class="zil sayi">🔔 onay bekleyen ' + para(bekleyen) + '</div>' : '') +
    (not ? '<div class="not">' + not + '</div>' : '') +
  '</div>';
}

function baslikCiz() {
  const h = $('#baslik');
  if (D.gorunum === 'kasa') {
    h.innerHTML =
      '<button class="yuvarlak" id="menuAc">☰</button>' +
      '<div class="orta">Kasa</div>' +
      '<button class="yuvarlak" id="yenile">↻</button>';
  } else {
    h.innerHTML =
      '<button class="geri" id="geriDon">‹ Kasa</button>' +
      '<div class="orta">' + kacak(D.defter ? D.defter.ad : '') + '</div>' +
      '<div class="yuvarlak" style="background:none"></div>';
  }
  const m = $('#menuAc'); if (m) m.onclick = menuAc;
  const y = $('#yenile'); if (y) y.onclick = yenile;
  const g = $('#geriDon'); if (g) g.onclick = () => { D.gorunum = 'kasa'; ciz(); };
}

/* ---------- ekranlar ---------- */
function ciz() {
  baslikCiz();
  if (D.gorunum === 'marka') return cizMarka();
  if (D.gorunum === 'defter') return cizDefter();
  return cizKasa();
}

function cizKasa() {
  const veri = D.defterler.map((d) => Object.assign(markaOzeti(d.ad), { simge: d.simge }));
  const toplam = veri.reduce((a, m) => a + m.teslim, 0);
  const bekleyen = veri.reduce((a, m) => a + m.bekleyen, 0);

  let h = hero('Teslim edilen kasa', toplam, bekleyen,
    'Yalnızca kasaya teslim edilmiş ve onaylanmış para.');
  h += donemSecici();

  h += '<div class="liste">' + veri.map((m) =>
    '<div class="satir dokunulur" data-marka="' + kacak(m.ad) + '">' +
      '<div class="simge">' + (m.simge || '📒') + '</div>' +
      '<div class="orta">' +
        '<div class="ad">' + kacak(m.ad) + '</div>' +
        '<div class="alt">' + (m.varMi
          ? (m.gunler.length ? m.gunler.length + ' teslim' : donemAdi() + ' teslim yok')
          : 'henüz bağlanmadı') + '</div>' +
      '</div>' +
      '<div class="sag sayi' + (m.varMi && m.teslim > 0 ? '' : ' pasif') + '">' +
        (m.varMi ? para(m.teslim) : '—') + '</div>' +
      '<div class="ok">›</div>' +
    '</div>'
  ).join('') + '</div>';

  $('#icerik').innerHTML = h;
  baglaDonem();
  $$('[data-marka]').forEach((el) => {
    el.onclick = async () => {
      D.defter = D.defterler.find((x) => x.ad === el.dataset.marka);
      D.gorunum = 'marka';
      ciz();
    };
  });
}

function cizMarka() {
  const m = markaOzeti(D.defter.ad);

  let h = hero(D.defter.ad + ' · teslim edilen kasa', m.teslim, m.bekleyen,
    m.guncel ? 'Son güncelleme ' + new Date(m.guncel).toLocaleDateString('tr-TR') : '');
  h += donemSecici();

  if (!m.varMi) {
    h += '<div class="bos-durum"><b>Henüz bağlanmadı</b>' +
      'Bu markanın rakamları gizli anahtar tanımlanınca günde bir kez otomatik gelecek.</div>';
  } else if (!m.gunler.length) {
    h += '<div class="bos-durum"><b>' + donemAdi() + ' teslim yok</b>' +
      'Bu dönemde kasaya teslim edilmiş para görünmüyor.</div>';
  } else {
    h += '<div class="baslik"><span>Teslim günleri</span>' +
         '<span class="sag">' + m.gunler.length + ' teslim</span></div>';
    h += '<div class="liste">' + m.gunler.map((g) => {
      const t = new Date(g.tarih + 'T00:00');
      return '<div class="satir">' +
        '<div class="simge">💰</div>' +
        '<div class="orta">' +
          '<div class="ad">' + t.getDate() + ' ' + AYLAR[t.getMonth()] + '</div>' +
          '<div class="alt">' + GUNLER[t.getDay()] + '</div>' +
        '</div>' +
        '<div class="sag sayi">' + para(g.teslim_alinan) + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  $('#icerik').innerHTML = h;
  baglaDonem();
}

function cizDefter() {
  const [bas, bit] = donemAraligi();
  const islem = D.islemler.filter((i) =>
    i.tarih.slice(0, 10) >= bas && i.tarih.slice(0, 10) <= bit);
  const bakiye = D.hesaplar.reduce((a, x) => a + Number(x.bakiye), 0);

  let h = hero(D.defter.ad + ' · elle tuttuğun defter', bakiye, 0,
    'Markanın kendi rakamları buraya girmez; onlar Kasa ekranında.');
  h += donemSecici();

  if (D.hesaplar.length) {
    h += '<div class="baslik"><span>Hesaplar</span></div><div class="liste">' +
      D.hesaplar.map((x) =>
        '<div class="satir"><div class="orta">' +
          '<div class="ad">' + kacak(x.ad) + '</div>' +
          '<div class="alt">' + ({ nakit: 'Nakit', banka: 'Banka',
            kredi_karti: 'Kredi kartı', cari: 'Cari', urun: 'Ürün' }[x.grup] || '') + '</div>' +
        '</div><div class="sag sayi' + (Number(x.bakiye) ? '' : ' pasif') + '">' +
          para(x.bakiye) + '</div></div>'
      ).join('') + '</div>';
  }

  if (islem.length) {
    h += '<div class="baslik"><span>' + donemAdi() + ' hareketleri</span></div>';
    h += '<div class="liste">' + islem.map((i) => {
      const k = D.kategoriler.find((x) => x.id === i.kategori_id);
      const t = new Date(i.tarih);
      return '<div class="satir">' +
        '<div class="simge">' + ((k && k.simge) || '•') + '</div>' +
        '<div class="orta"><div class="ad">' +
          kacak((k && k.ad) || (i.tip === 'transfer' ? 'Transfer' : '—')) +
          (i.odendi ? '' : ' 🔔') + '</div>' +
          '<div class="alt">' + t.getDate() + ' ' + AYLAR[t.getMonth()] +
          (i.aciklama ? ' · ' + kacak(i.aciklama) : '') + '</div></div>' +
        '<div class="sag sayi" style="color:' +
          (i.tip === 'gelir' ? 'var(--mavi)' : 'var(--kirmizi)') + '">' +
          (i.tip === 'gelir' ? '' : '−') + para(i.tutar) + '</div>' +
      '</div>';
    }).join('') + '</div>';
  } else {
    h += '<div class="bos-durum"><b>' + donemAdi() + ' kaydı yok</b>' +
      'Aşağıdaki düğmelerle gelir veya gider ekleyebilirsin.</div>';
  }

  h += '<div style="display:flex;gap:10px;padding:20px 16px">' +
    '<button id="gelirEkle" style="flex:1;padding:15px;border-radius:14px;' +
      'background:var(--kart);color:var(--mavi);font-weight:600">⊕ Gelir</button>' +
    '<button id="giderEkle" style="flex:1;padding:15px;border-radius:14px;' +
      'background:var(--kart);color:var(--kirmizi);font-weight:600">⊖ Gider</button>' +
  '</div>';

  $('#icerik').innerHTML = h;
  baglaDonem();
  $('#gelirEkle').onclick = () => panelAc('gelir');
  $('#giderEkle').onclick = () => panelAc('gider');
}

function baglaDonem() {
  $$('[data-donem]').forEach((b) => {
    b.onclick = () => { D.donem = b.dataset.donem; ciz(); };
  });
}

/* ---------- menü ---------- */
function menuAc() {
  $('#menuKim').textContent = D.eposta;
  $('#menuIcerik').innerHTML =
    '<div class="baslik"><span>Elle tuttuğun defter</span></div>' +
    '<div class="liste">' + D.defterler.map((d) =>
      '<div class="satir dokunulur" data-defter="' + d.id + '">' +
        '<div class="simge">' + (d.simge || '📒') + '</div>' +
        '<div class="orta"><div class="ad">' + kacak(d.ad) + '</div>' +
        '<div class="alt">kasa, banka, elle kayıt</div></div>' +
        '<div class="ok">›</div>' +
      '</div>').join('') + '</div>' +
    '<div class="baslik"><span>Uygulama</span></div>' +
    '<div class="liste">' +
      '<div class="satir dokunulur" id="menuYenile"><div class="simge">↻</div>' +
        '<div class="orta"><div class="ad">Marka rakamlarını yenile</div>' +
        '<div class="alt">normalde her gece otomatik</div></div></div>' +
      '<div class="satir dokunulur" id="menuCikis"><div class="simge">⎋</div>' +
        '<div class="orta"><div class="ad">Çıkış yap</div></div></div>' +
    '</div>' +
    '<div style="padding:24px 20px"><button class="geri" id="menuKapat">‹ Kapat</button></div>';

  $('#menu').classList.add('acik');
  $('#menuKapat').onclick = () => $('#menu').classList.remove('acik');
  $('#menuYenile').onclick = async () => {
    $('#menu').classList.remove('acik'); await yenile();
  };
  $('#menuCikis').onclick = async () => {
    await sb.auth.signOut(); location.reload();
  };
  $$('[data-defter]').forEach((el) => {
    el.onclick = async () => {
      D.defter = D.defterler.find((x) => x.id === el.dataset.defter);
      D.gorunum = 'defter';
      $('#menu').classList.remove('acik');
      $('#icerik').innerHTML = '<div class="yukleniyor">Yükleniyor…</div>';
      await defterVerisi();
      ciz();
    };
  });
}

async function yenile() {
  const y = $('#yenile');
  if (y) { y.textContent = '…'; y.disabled = true; }
  try {
    const { data, error } = await sb.functions.invoke('marka-ozet');
    if (error) throw error;
    if (data && data.durum === 'hata') alert('Yenilenemedi:\n' + data.mesaj);
    else if (data && data.medicamine && data.medicamine.atlandi)
      alert('Bir marka güncellendi.\n\nDiğeri için gizli anahtar henüz tanımlı değil.');
  } catch (e) {
    alert('Yenilenemedi: ' + (e.message || e));
  }
  if (y) { y.textContent = '↻'; y.disabled = false; }
  await veriYukle();
}

/* ---------- kayıt paneli ---------- */
const P = { tip: 'gelir', tutar: '', odendi: true };

function panelAc(tip) {
  P.tip = tip; P.tutar = ''; P.odendi = true;
  $('#panel').className = 'acik ' + tip;
  $('#perde').classList.add('acik');
  $$('.sekmeler button').forEach((b) => b.classList.toggle('aktif', b.dataset.tip === tip));
  $('#hedefAlan').classList.toggle('gizli', tip !== 'transfer');
  $('#fTarih').value = bugun();
  $('#fAciklama').value = '';
  $('#fOdendi').classList.add('acik');
  $('#vadeAlan').classList.add('gizli');
  $('#odendiBaslik').textContent = tip === 'gelir' ? 'Parası alındı' : 'Parası ödendi';

  const hesapSec = D.hesaplar.filter((h) => h.grup !== 'urun')
    .map((h) => '<option value="' + h.hesap_id + '">' + kacak(h.ad) + '</option>').join('');
  $('#fHesap').innerHTML = hesapSec;
  $('#fHedef').innerHTML = hesapSec;
  $('#fKategori').innerHTML = '<option value="">— kategori yok —</option>' +
    D.kategoriler.filter((k) => k.tip === (tip === 'gelir' ? 'gelir' : 'gider'))
      .map((k) => '<option value="' + k.id + '">' + (k.simge || '') + ' ' +
        kacak(k.ad) + '</option>').join('');
  tutarCiz();
}
const panelKapat = () => {
  $('#panel').className = '';
  $('#perde').classList.remove('acik');
};
function tutarCiz() {
  const t = P.tutar || '0';
  $('#tutarGoster').textContent =
    t.indexOf(',') >= 0 ? t : TL.format(Number(t) || 0).replace(',00', '');
  $('#kaydetDugme').disabled = !(Number(P.tutar.replace(',', '.')) > 0);
}

$('#perde').onclick = panelKapat;
$('#panelKapat').onclick = panelKapat;
$$('.sekmeler button').forEach((b) => { b.onclick = () => panelAc(b.dataset.tip); });

$$('.tuslar [data-t]').forEach((b) => {
  b.onclick = () => {
    const t = b.dataset.t;
    if (t === 'sil') P.tutar = P.tutar.slice(0, -1);
    else if (t === ',') { if (P.tutar.indexOf(',') < 0) P.tutar = (P.tutar || '0') + ','; }
    else {
      const ond = P.tutar.split(',')[1];
      if (ond != null && ond.length + t.length > 2) return;
      P.tutar += t;
    }
    tutarCiz();
  };
});

$('#fOdendi').onclick = () => {
  P.odendi = !P.odendi;
  $('#fOdendi').classList.toggle('acik', P.odendi);
  $('#vadeAlan').classList.toggle('gizli', P.odendi);
  if (!P.odendi && !$('#fVade').value) $('#fVade').value = bugun();
};

$('#kaydetDugme').onclick = async () => {
  const tutar = Number(P.tutar.replace(',', '.'));
  if (!(tutar > 0)) return;
  const kayit = {
    defter_id: D.defter.id,
    tip: P.tip,
    hesap_id: $('#fHesap').value || null,
    hedef_hesap_id: P.tip === 'transfer' ? ($('#fHedef').value || null) : null,
    kategori_id: P.tip === 'transfer' ? null : ($('#fKategori').value || null),
    tutar: tutar,
    tarih: new Date($('#fTarih').value + 'T12:00:00').toISOString(),
    aciklama: $('#fAciklama').value.trim() || null,
    odendi: P.tip === 'transfer' ? true : P.odendi,
    vade_tarihi: (!P.odendi && P.tip !== 'transfer') ? ($('#fVade').value || null) : null,
  };
  if (P.tip === 'transfer' && kayit.hesap_id === kayit.hedef_hesap_id) {
    alert('Kaynak ve hedef hesap aynı olamaz.'); return;
  }
  $('#kaydetDugme').disabled = true;
  const { error } = await sb.from('kasa_islemler').insert(kayit);
  $('#kaydetDugme').disabled = false;
  if (error) { alert('Kaydedilemedi: ' + error.message); return; }
  panelKapat();
  await defterVerisi();
  ciz();
};

/* ---------- oturum ---------- */
sb.auth.getSession().then(({ data }) => { if (data.session) basla(); });
