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
    address: record.address || '',
    city: record.city || '',
    state: record.state || '',
    email: record.email || '',
    phone: record.phone || '',
    url: record.url || '',
    integrationKey: record.key || record.api_key || record.apiKey || '',
    integrationSecret: record.secret || record.secret_key || record.secretKey || '',
    token: record.token || '',
    description: record.description || '',
    product_settings: normalizeProductSettingsFromRecord(record),
  };
};

const fieldValue = (form, field) => String(form?.[field] ?? '').trim();

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
  if (!fieldValue(form, 'address')) errors.address = 'Address is required';
  if (!fieldValue(form, 'city')) errors.city = 'City is required';
  if (!fieldValue(form, 'state')) errors.state = 'State is required';
  if (!fieldValue(form, 'url')) errors.url = 'URL is required';
  if (!fieldValue(form, 'integrationKey')) errors.integrationKey = 'Key is required';
  if (!isEdit && !fieldValue(form, 'integrationSecret')) {
    errors.integrationSecret = 'Secret is required';
  }
  if (!fieldValue(form, 'description')) errors.description = 'Description is required';

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
    address: fieldValue(form, 'address'),
    city: fieldValue(form, 'city'),
    state: fieldValue(form, 'state'),
    url: fieldValue(form, 'url'),
    key: fieldValue(form, 'integrationKey'),
    description: fieldValue(form, 'description'),
  };

  const secret = fieldValue(form, 'integrationSecret');
  if (secret || !isEdit) payload.secret = secret;

  const email = fieldValue(form, 'email');
  const phone = fieldValue(form, 'phone');
  const token = fieldValue(form, 'token');

  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (token) payload.token = token;

  Object.assign(payload, productSettingsToPayload(form.product_settings));

  return payload;
};
