import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';

export const STORE_TYPE_OPTIONS = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'daraz', label: 'Daraz' },
];

export const EMPTY_INTEGRATION_FORM = {
  store_type: 'shopify',
  name: '',
  storeLogoUrl: '',
  address: '',
  city: '',
  state: '',
  email: '',
  phone: '',
  url: '',
  integrationKey: '',
  integrationSecret: '',
  token: '',
  description: '',
  smtp_host: 'ssl://smtp.gmail.com',
  smtp_port: 465,
  smtp_username: '',
  smtp_password: '',
  product_settings: {
    sync_product_name: 'yes',
    sync_product_slug: 'yes',
    sync_product_image: 'yes',
    sync_product_price: 'yes',
    sync_product_description: 'yes',
    sync_product_status: 'yes',
  },
};

export const PRODUCT_SETTING_FIELDS = [
  { key: 'sync_product_name', label: 'Sync product name' },
  { key: 'sync_product_slug', label: 'Sync product slug' },
  { key: 'sync_product_image', label: 'Sync product image' },
  { key: 'sync_product_price', label: 'Sync product price' },
  { key: 'sync_product_description', label: 'Sync product description' },
  { key: 'sync_product_status', label: 'Sync product status' },
];

const toYesNo = (value) => {
  if (value === 'yes' || value === 'no') return value;
  if (value === true || value === 'true' || value === 1 || value === '1') return 'yes';
  if (value === false || value === 'false' || value === 0 || value === '0') return 'no';
  return 'yes';
};

const normalizeProductSettingsFromRecord = (record) => {
  const settings = { ...EMPTY_INTEGRATION_FORM.product_settings };
  if (!record || typeof record !== 'object') return settings;

  const nested = record.product_settings ?? record.productSettings;
  for (const { key } of PRODUCT_SETTING_FIELDS) {
    const raw = record[key] ?? nested?.[key];
    if (raw != null) settings[key] = toYesNo(raw);
  }
  return settings;
};

const productSettingsToPayload = (productSettings) => {
  const payload = {};
  for (const { key } of PRODUCT_SETTING_FIELDS) {
    payload[key] = toYesNo(productSettings?.[key]);
  }
  return payload;
};

export const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

export const integrationNameFromRecord = (item) =>
  item?.name || item?.store_name || item?.storeName || 'Integration';

export const storeTypeLabel = (value) => {
  const match = STORE_TYPE_OPTIONS.find((opt) => opt.value === value);
  return match ? match.label : value || '-';
};

/** Live PK codes look like 4_506036_…. Docs examples use 0_…. */
const DARAZ_AUTH_CODE_RE = /^\d+_[A-Za-z0-9._-]+$/;

const takeDarazAuthCode = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const token = text.split(/[\s&#?"'<>]/)[0];
  return DARAZ_AUTH_CODE_RE.test(token) ? token : '';
};

/** Pull a Daraz seller code (`4_506036_…` or `0_…`) from Token, a callback URL, webhook JSON, or `?code=`. */
export const extractDarazSellerCode = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const asCode = takeDarazAuthCode(text);
  if (asCode) return asCode;

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const qs =
        parsed?.captured?.query_string ||
        parsed?.query_string ||
        parsed?.captured?.query ||
        null;
      if (qs) {
        return extractDarazSellerCode(
          String(qs).includes('=') && !String(qs).includes('://')
            ? `https://callback.local/?${qs}`
            : qs,
        );
      }
      const nested =
        parsed?.code ||
        parsed?.get?.code ||
        parsed?.captured?.code ||
        parsed?.captured?.get?.code ||
        parsed?.data?.code ||
        null;
      if (nested) return extractDarazSellerCode(nested);
    } catch {
      /* not JSON */
    }
  }

  try {
    if (text.includes('://') || text.startsWith('http')) {
      const url = new URL(text);
      const fromQuery = takeDarazAuthCode(url.searchParams.get('code'));
      if (fromQuery) return fromQuery;
    }
  } catch {
    /* not a URL */
  }

  const queryMatch = text.match(/[?&]code=(\d+_[A-Za-z0-9._-]+)/i);
  if (queryMatch) return queryMatch[1];

  const embedded = text.match(/(?:^|[^A-Za-z0-9])(\d+_[A-Za-z0-9._-]+)/);
  if (embedded) return takeDarazAuthCode(embedded[1]);

  if (/^[^=&]*&?[^=]+=/.test(text) && /code=/i.test(text)) {
    return extractDarazSellerCode(`https://callback.local/?${text}`);
  }

  return '';
};

export const isDarazCallbackUrlWithoutCode = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  if (extractDarazSellerCode(text)) return false;
  return /webhook\.php|pos_webhook|callback/i.test(text);
};

export const isDarazAuthCode = (value) => Boolean(extractDarazSellerCode(value));

export const pickDarazAuthCode = (item) => {
  if (!item || typeof item !== 'object') return '';
  const candidates = [item.code, item.seller_code, item.sellerCode, item.token];
  for (const raw of candidates) {
    const extracted = extractDarazSellerCode(raw);
    if (extracted) return extracted;
  }
  return '';
};

export const pickDarazRefreshToken = (item) => {
  if (!item || typeof item !== 'object') return '';
  const candidates = [item.refresh_token, item.refreshToken];
  for (const raw of candidates) {
    const value = String(raw ?? '').trim();
    if (value) return value;
  }
  return '';
};

export const DARAZ_PK_AUTHORIZE_BASE = 'https://api.daraz.pk/oauth/authorize';
export const DARAZ_PK_CALLBACK_URL =
  'https://testv3.websitedemolynk.com/pos_webhook/webhook.php?callback';

export const pickDarazAppKey = (item) => {
  if (!item || typeof item !== 'object') return '';
  return String(item.key || item.app_key || item.appKey || item.client_id || '').trim();
};

export const buildDarazAuthorizeUrl = ({ appKey, integrationId, redirectUri } = {}) => {
  const clientId = String(appKey || '').trim();
  if (!clientId) return '';
  const query = new URLSearchParams({
    response_type: 'code',
    force_auth: 'true',
    redirect_uri: String(redirectUri || DARAZ_PK_CALLBACK_URL).trim(),
    client_id: clientId,
  });
  if (integrationId) query.set('state', String(integrationId));
  return `${DARAZ_PK_AUTHORIZE_BASE}?${query.toString()}`;
};

export const darazTokenAction = (item) => {
  if (pickDarazRefreshToken(item)) return 'refresh';
  if (pickDarazAuthCode(item)) return 'generate';
  return String(item?.token ?? '').trim() ? 'refresh' : 'generate';
};

const pickStoreLogoUrl = (record) => {
  if (!record || typeof record !== 'object') return '';
  const raw = record.image ?? record.store_logo ?? record.storeLogo ?? record.logo ?? '';
  return resolveCategoryMediaUrl(raw);
};

export const integrationRecordToForm = (record) => {
  if (!record) return { ...EMPTY_INTEGRATION_FORM };
  return {
    store_type: record.store_type || record.storeType || 'shopify',
    name: record.name || record.store_name || record.storeName || '',
    storeLogoUrl: pickStoreLogoUrl(record),
    address: displayOptionalApiText(record.address),
    city: displayOptionalApiText(record.city),
    state: displayOptionalApiText(record.state),
    email: record.email || '',
    phone: record.phone || '',
    url: record.url || '',
    integrationKey: record.key || record.api_key || record.apiKey || '',
    integrationSecret: record.secret || record.secret_key || record.secretKey || '',
    token: record.token || '',
    description: displayOptionalApiText(record.description),
    smtp_host: record.smtp_host || record.smtpHost || EMPTY_INTEGRATION_FORM.smtp_host,
    smtp_port:
      record.smtp_port != null || record.smtpPort != null
        ? Number(record.smtp_port ?? record.smtpPort)
        : EMPTY_INTEGRATION_FORM.smtp_port,
    smtp_username: record.smtp_username || record.smtpUsername || '',
    smtp_password: '',
    product_settings: normalizeProductSettingsFromRecord(record),
  };
};

const fieldValue = (form, field) => String(form?.[field] ?? '').trim();

/** API still requires these keys; UI treats them as optional. */
const OPTIONAL_API_PLACEHOLDER = '-';

const optionalApiText = (form, field) => fieldValue(form, field) || OPTIONAL_API_PLACEHOLDER;

const displayOptionalApiText = (value) => {
  const text = String(value ?? '').trim();
  return !text || text === OPTIONAL_API_PLACEHOLDER ? '' : text;
};

export const syncIntegrationFormFromDom = (form, formElement) => {
  if (!formElement) return form;
  const formData = new FormData(formElement);
  return {
    ...form,
    store_type: formData.get('store_type')?.toString() ?? form.store_type,
    name: formData.get('name')?.toString() ?? form.name,
    address: formData.get('address')?.toString() ?? form.address,
    city: formData.get('city')?.toString() ?? form.city,
    state: formData.get('state')?.toString() ?? form.state,
    email: formData.get('email')?.toString() ?? form.email,
    phone: formData.get('phone')?.toString() ?? form.phone,
    url: formData.get('url')?.toString() ?? form.url,
    description: formData.get('description')?.toString() ?? form.description,
    integrationKey: formData.get('integrationKey')?.toString() ?? form.integrationKey,
    integrationSecret: formData.get('integrationSecret')?.toString() ?? form.integrationSecret,
    token: formData.get('token')?.toString() ?? form.token,
    smtp_host: formData.get('smtp_host')?.toString() ?? form.smtp_host,
    smtp_port: (() => {
      const raw = formData.get('smtp_port')?.toString();
      if (raw == null || raw === '') return form.smtp_port;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : form.smtp_port;
    })(),
    smtp_username: formData.get('smtp_username')?.toString() ?? form.smtp_username,
    smtp_password: formData.get('smtp_password')?.toString() ?? form.smtp_password,
  };
};

export const validateIntegrationForm = (form, { isEdit = false } = {}) => {
  const errors = {};
  const storeType = fieldValue(form, 'store_type');

  if (!storeType) {
    errors.store_type = 'Store type is required';
  } else if (!STORE_TYPE_OPTIONS.some((opt) => opt.value === storeType)) {
    errors.store_type = 'Invalid store type';
  }

  if (!fieldValue(form, 'name')) errors.name = 'Store name is required';
  if (!fieldValue(form, 'url')) errors.url = 'URL is required';
  if (!fieldValue(form, 'integrationKey')) errors.integrationKey = 'Key is required';
  if (!isEdit && !fieldValue(form, 'integrationSecret')) {
    errors.integrationSecret = 'Secret is required';
  }
  if (storeType === 'daraz') {
    const token = fieldValue(form, 'token');
    if (token && isDarazCallbackUrlWithoutCode(token) && !extractDarazSellerCode(token)) {
      errors.token =
        'That is the webhook URL, not a seller code. Leave Token empty and use Generate Token.';
    }
  }
  const email = fieldValue(form, 'email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'Enter a valid email';
  }

  return errors;
};

export const buildIntegrationPayload = (form, { isEdit = false } = {}) => {
  const payload = {
    store_type: fieldValue(form, 'store_type'),
    name: fieldValue(form, 'name'),
    address: optionalApiText(form, 'address'),
    city: optionalApiText(form, 'city'),
    state: optionalApiText(form, 'state'),
    url: fieldValue(form, 'url'),
    key: fieldValue(form, 'integrationKey'),
    description: optionalApiText(form, 'description'),
  };

  const secret = fieldValue(form, 'integrationSecret');
  if (secret || !isEdit) payload.secret = secret;

  const email = fieldValue(form, 'email');
  const phone = fieldValue(form, 'phone');
  const token = fieldValue(form, 'token');
  const smtpHost = fieldValue(form, 'smtp_host');
  const smtpUsername = fieldValue(form, 'smtp_username');
  const smtpPassword = fieldValue(form, 'smtp_password');
  const smtpPortRaw = form?.smtp_port;
  const smtpPort = smtpPortRaw === '' || smtpPortRaw == null ? null : Number(smtpPortRaw);

  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (token || fieldValue(form, 'store_type') === 'daraz') payload.token = token;
  if (smtpHost) payload.smtp_host = smtpHost;
  if (Number.isFinite(smtpPort)) payload.smtp_port = smtpPort;
  if (smtpUsername) payload.smtp_username = smtpUsername;
  if (smtpPassword) payload.smtp_password = smtpPassword;

  Object.assign(payload, productSettingsToPayload(form.product_settings));

  return payload;
};
