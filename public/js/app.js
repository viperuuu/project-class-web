const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const state = { products: [], category: 'Semua', query: '', sort: 'featured', cart: JSON.parse(localStorage.getItem('lautkecil-cart') || '{}') };
const $ = (selector) => document.querySelector(selector);
const productGrid = $('#productGrid');
let toastTimer;

function showToast(message, isError = false) {
  const toast = $('#toast'); toast.textContent = message; toast.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

async function api(path, options) {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Terjadi kendala. Coba lagi sebentar.');
  return data;
}

function renderProducts() {
  const normalized = state.query.trim().toLocaleLowerCase('id');
  const products = state.products.filter((product) => (state.category === 'Semua' || product.category === state.category) &&
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('id').includes(normalized));
  if (state.sort === 'low') products.sort((a, b) => a.price - b.price);
  if (state.sort === 'high') products.sort((a, b) => b.price - a.price);
  $('#emptyState').hidden = products.length > 0;
  productGrid.innerHTML = products.map((product) => `
    <article class="product-card">
      <div class="product-image"><img src="${product.image}" alt="${product.name}" loading="lazy"><span class="badge">${product.badge}</span>
        <button class="quick-add" data-add="${product.id}" aria-label="Tambah ${product.name} ke keranjang">+</button></div>
      <div class="product-info"><div class="product-meta"><span>${product.category}</span><span>● Stok ${product.stock}</span></div>
        <h3>${product.name}</h3><p>${product.description}</p><div class="price">${rupiah.format(product.price)} <small>/ ekor</small></div></div>
    </article>`).join('');
}

function persistCart() { localStorage.setItem('lautkecil-cart', JSON.stringify(state.cart)); renderCart(); }
function addToCart(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product || product.stock < 1) return showToast('Stok ikan ini sedang kosong.', true);
  if ((state.cart[id] || 0) >= product.stock) return showToast('Jumlah sudah mencapai stok yang tersedia.', true);
  state.cart[id] = (state.cart[id] || 0) + 1; persistCart(); showToast(`${product.name} masuk ke keranjang.`);
}
function renderCart() {
  const items = Object.entries(state.cart).map(([id, quantity]) => ({ product: state.products.find((item) => item.id === id), quantity })).filter((item) => item.product && item.quantity > 0);
  const count = items.reduce((total, item) => total + item.quantity, 0);
  $('#cartCount').textContent = count;
  $('#cartItems').innerHTML = items.length ? items.map(({ product, quantity }) => `<div class="cart-item"><img src="${product.image}" alt=""><div><strong>${product.name}</strong><small>${rupiah.format(product.price)} / ekor</small><div class="qty-controls"><button data-qty="${product.id}" data-change="-1" aria-label="Kurangi">−</button><span>${quantity}</span><button data-qty="${product.id}" data-change="1" aria-label="Tambah">+</button></div></div><button class="remove-item" data-remove="${product.id}" aria-label="Hapus ${product.name}">×</button></div>`).join('') : '<div class="cart-empty">Keranjangmu masih kosong.<br>Yuk, temukan teman kecil favoritmu!</div>';
  $('#cartTotal').textContent = rupiah.format(items.reduce((total, item) => total + item.product.price * item.quantity, 0));
  $('#checkoutButton').disabled = !items.length;
}
function setDrawer(open) {
  $('#cartDrawer').classList.toggle('open', open); $('#scrim').classList.toggle('open', open);
  $('#cartDrawer').setAttribute('aria-hidden', String(!open)); document.body.style.overflow = open ? 'hidden' : '';
}

productGrid.addEventListener('click', (event) => { const button = event.target.closest('[data-add]'); if (button) addToCart(button.dataset.add); });
$('#cartItems').addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (remove) { delete state.cart[remove.dataset.remove]; return persistCart(); }
  const quantityButton = event.target.closest('[data-qty]');
  if (quantityButton) { const id = quantityButton.dataset.qty; const next = (state.cart[id] || 0) + Number(quantityButton.dataset.change); if (next <= 0) delete state.cart[id]; else state.cart[id] = next; persistCart(); }
});
$('#filters').addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; $('#filters .active').classList.remove('active'); button.classList.add('active'); renderProducts(); });
$('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; renderProducts(); });
$('#sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; renderProducts(); });
$('#openCart').addEventListener('click', () => setDrawer(true)); $('#closeCart').addEventListener('click', () => setDrawer(false)); $('#scrim').addEventListener('click', () => setDrawer(false));
$('#checkoutButton').addEventListener('click', () => { setDrawer(false); $('#orderDialog').showModal(); });
$('#closeDialog').addEventListener('click', () => $('#orderDialog').close());
$('#orderDialog').addEventListener('click', (event) => { if (event.target === $('#orderDialog')) $('#orderDialog').close(); });
$('#orderForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true;
  const customer = Object.fromEntries(new FormData(form));
  try {
    const result = await api('/orders', { method: 'POST', body: JSON.stringify({ customer, items: Object.entries(state.cart).map(([productId, quantity]) => ({ productId, quantity })) }) });
    state.cart = {}; persistCart(); $('#orderDialog').close(); form.reset(); showToast(`Pesanan ${result.order.id} berhasil dibuat. Total ${rupiah.format(result.order.total)}.`);
    const response = await api('/products'); state.products = response.products; renderProducts();
  } catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});
$('#year').textContent = new Date().getFullYear();

// Modal Dokumentasi Teknis & API
const openDevModal = $('#openDevModal');
const closeDevModal = $('#closeDevModal');
const devModal = $('#devModal');
if (openDevModal && devModal) {
  openDevModal.addEventListener('click', () => devModal.showModal());
}
if (closeDevModal && devModal) {
  closeDevModal.addEventListener('click', () => devModal.close());
}
if (devModal) {
  devModal.addEventListener('click', (event) => {
    if (event.target === devModal) devModal.close();
  });
}

const schemaCode = $('#sqlSchemaCode');
const schemaStatus = $('#schemaStatus');
if (schemaCode) {
  fetch('/schema.sql').then((response) => {
    if (!response.ok) throw new Error('File schema.sql tidak dapat dimuat.');
    return response.text();
  }).then((sql) => {
    schemaCode.textContent = sql;
  }).catch((error) => {
    if (schemaStatus) schemaStatus.textContent = error.message;
  });
}
const copySchemaBtn = $('#copySchema');
if (copySchemaBtn && schemaCode) {
  copySchemaBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(schemaCode.textContent).then(() => showToast('SQL berhasil disalin.')).catch(() => showToast('SQL tidak dapat disalin dari browser ini.', true));
  });
}
api('/products').then(({ products }) => { state.products = products; renderProducts(); renderCart(); }).catch((error) => { productGrid.innerHTML = '<div class="loading-state">Katalog belum bisa dimuat. Pastikan server LautKecil sedang berjalan.</div>'; showToast(error.message, true); });
