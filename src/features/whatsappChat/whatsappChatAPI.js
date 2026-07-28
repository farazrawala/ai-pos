import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getHeaders = () => {
  const token = typeof window === 'undefined' ? '' : localStorage.getItem('authToken') || '';
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

/** Strip spaces, dashes, brackets, and +; ensure Pakistan country code 92. */
export function normalizePhoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

/** True when two phone strings refer to the same number (normalized / suffix match). */
export function phonesMatch(a, b) {
  const x = normalizePhoneDigits(a);
  const y = normalizePhoneDigits(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

/**
 * Company WhatsApp number from the logged-in company model (`whatsapp_number`).
 * Used to tell “my” (outgoing) messages from contact (incoming) ones.
 */
export function getCompanyWhatsappNumber(company) {
  if (!company || typeof company !== 'object') return '';
  return normalizePhoneDigits(company.whatsapp_number ?? company.whatsappNumber ?? '');
}

function pickMessageParty(raw, keys) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value == null || value === '') continue;
    if (typeof value === 'object') {
      const nested =
        value.phone ?? value.number ?? value.whatsapp_number ?? value.mobile ?? value.id;
      const digits = normalizePhoneDigits(nested);
      if (digits) return digits;
      continue;
    }
    const digits = normalizePhoneDigits(value);
    if (digits) return digits;
  }
  return '';
}

/**
 * Resolve bubble side: outgoing = sent from company.whatsapp_number.
 */
export function resolveMessageDirection(raw, ourNumber) {
  const explicit = String(
    raw?.direction ?? raw?.message_direction ?? raw?.msg_direction ?? ''
  ).toLowerCase();
  if (['outgoing', 'outbound', 'sent', 'out', 'send'].includes(explicit)) {
    return 'outgoing';
  }
  if (['incoming', 'inbound', 'received', 'in', 'receive'].includes(explicit)) {
    return 'incoming';
  }

  if (
    raw?.fromMe === true ||
    raw?.from_me === true ||
    raw?.is_from_me === true ||
    raw?.mine === true
  ) {
    return 'outgoing';
  }
  if (raw?.fromMe === false || raw?.from_me === false || raw?.is_from_me === false) {
    return 'incoming';
  }

  const our = normalizePhoneDigits(ourNumber);
  const from = pickMessageParty(raw, [
    'from_user_id',
    'from',
    'sender',
    'from_number',
    'source',
    'sender_number',
  ]);
  const to = pickMessageParty(raw, [
    'to_user_id',
    'to',
    'receiver',
    'to_number',
    'destination',
    'recipient',
    'recipient_number',
  ]);

  if (our) {
    if (from && phonesMatch(from, our)) return 'outgoing';
    if (to && phonesMatch(to, our)) return 'incoming';
  }

  return 'incoming';
}

/** Re-resolve direction for a normalized message using company WhatsApp number. */
export function getChatMessageDirection(message, ourNumber) {
  if (!message || typeof message !== 'object') return 'incoming';
  const our = normalizePhoneDigits(ourNumber);
  if (our) {
    if (message.from && phonesMatch(message.from, our)) return 'outgoing';
    if (message.to && phonesMatch(message.to, our)) return 'incoming';
  }
  return message.direction === 'outgoing' ? 'outgoing' : 'incoming';
}

function sortContacts(list) {
  return [...list].sort((a, b) => {
    const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      sensitivity: 'base',
    });
  });
}

function userRoles(raw) {
  const collected = [];
  const push = (value) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === 'object') {
      push(value.name ?? value.role ?? value.label);
      return;
    }
    collected.push(String(value).toUpperCase());
  };
  push(raw?.role);
  push(raw?.roles);
  return collected;
}

function isAdminUser(raw) {
  return userRoles(raw).some((r) => r === 'ADMIN' || r.includes('ADMIN'));
}

function normalizeContact(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (isAdminUser(raw)) return null;
  const contactId = String(raw.contactId ?? raw.contact_id ?? raw._id ?? raw.id ?? '').trim();
  if (!contactId) return null;
  const phone = normalizePhoneDigits(
    raw.phone ?? raw.mobile ?? raw.number ?? raw.phoneNumber ?? raw.whatsapp_number ?? ''
  );
  // Chat requires a phone number — skip incomplete / system accounts.
  if (!phone) return null;
  const avatarRaw =
    raw.avatarUrl ||
    raw.avatar ||
    raw.profile_picture ||
    raw.profilePicture ||
    raw.profile_image ||
    raw.profileImage ||
    '';
  const avatarUrl =
    typeof avatarRaw === 'object' && avatarRaw !== null
      ? String(avatarRaw.url || avatarRaw.path || '')
      : String(avatarRaw || '');
  return {
    contactId,
    name: String(raw.name || raw.contact_name || '').trim() || 'Unknown',
    phone,
    avatarUrl,
    lastMessage: String(raw.lastMessage ?? raw.last_message ?? '').trim(),
    lastMessageTime: raw.lastMessageTime ?? raw.last_message_time ?? raw.updatedAt ?? null,
    unread: Number(raw.unread ?? raw.unread_count ?? 0) || 0,
    online: Boolean(raw.online ?? raw.is_online ?? false),
    lastSeen: raw.lastSeen ?? raw.last_seen ?? null,
  };
}

function normalizeMessage(raw, ourNumber = '') {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw._id ?? raw.message_id ?? '').trim();
  if (!id) return null;
  const from = pickMessageParty(raw, [
    'from_user_id',
    'from',
    'sender',
    'from_number',
    'source',
    'sender_number',
  ]);
  const to = pickMessageParty(raw, [
    'to_user_id',
    'to',
    'receiver',
    'to_number',
    'destination',
    'recipient',
    'recipient_number',
  ]);
  const direction = resolveMessageDirection(raw, ourNumber);
  const type = String(raw.type || 'text').toLowerCase();
  const populatedMsg =
    raw.whatsapp_message_id && typeof raw.whatsapp_message_id === 'object'
      ? raw.whatsapp_message_id
      : null;
  const status = String(
    populatedMsg?.status ?? raw.status ?? raw.message_status ?? ''
  ).toLowerCase();
  return {
    id,
    direction,
    from,
    to,
    type,
    message: raw.message ?? raw.text ?? raw.caption ?? '',
    mediaUrl: raw.mediaUrl || raw.media_url || raw.url || raw.file_url || '',
    fileName: raw.fileName || raw.file_name || raw.filename || '',
    timestamp: raw.timestamp || raw.createdAt || raw.whatsapp_time || null,
    status: status || 'not_started',
    unread: Boolean(raw.unread ?? raw.is_unread ?? false),
    latitude: raw.latitude ?? raw.lat ?? null,
    longitude: raw.longitude ?? raw.lng ?? null,
  };
}

/**
 * GET /user/get-all?search=&searchFields=name,phone&limit=50
 * Empty query loads all users (limit 50). Maps users into chat contact rows.
 */
export async function searchWhatsappContactsRequest(q) {
  const query = String(q || '').trim();

  const params = new URLSearchParams({
    limit: '50',
  });
  if (query) {
    params.set('search', query);
    params.set('searchFields', 'name,phone');
  }

  const url = `${BASE_URL}user/get-all?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  const data = await response.json().catch(() => ({}));

  const message = String(data?.message || data?.error || '').toLowerCase();
  if (
    response.status === 404 ||
    message.includes('route not found') ||
    message.includes('not found')
  ) {
    return [];
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `Search failed (${response.status})`);
  }

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.users)
        ? data.users
        : [];

  return sortContacts(list.map(normalizeContact).filter(Boolean));
}

/**
 * GET /chat/get-all?number=&populate=whatsapp_message_id
 * Messages are returned oldest→newest for display.
 * Pass `ourNumber` (company.whatsapp_number) so sent messages align as outgoing.
 */
export async function fetchWhatsappChatRequest(
  number,
  { page = 1, limit = 50, ourNumber = '' } = {}
) {
  const phone = normalizePhoneDigits(number);
  if (!phone) throw new Error('Phone number is required');

  const params = new URLSearchParams({
    number: phone,
    page: String(page),
    limit: String(limit),
    populate: 'whatsapp_message_id',
  });
  const url = `${BASE_URL}chat/get-all?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  const data = await response.json().catch(() => ({}));

  const errMessage = String(data?.message || data?.error || '').toLowerCase();
  if (
    response.status === 404 ||
    errMessage.includes('route not found') ||
    errMessage.includes('not found')
  ) {
    throw new Error('Previous chat not found.');
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `Failed to load chat (${response.status})`);
  }

  const payload =
    data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
  const rawMessages = Array.isArray(payload?.messages)
    ? payload.messages
    : Array.isArray(payload?.chats)
      ? payload.chats
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

  const myNumber = normalizePhoneDigits(ourNumber);
  const messages = rawMessages.map((row) => normalizeMessage(row, myNumber)).filter(Boolean);
  // Ensure chronological order (oldest first)
  messages.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  const hasMore = Boolean(payload?.hasMore ?? payload?.has_more ?? messages.length >= limit);

  return {
    messages,
    hasMore,
    page,
    limit,
    contact: payload?.contact ? normalizeContact(payload.contact) : null,
  };
}
