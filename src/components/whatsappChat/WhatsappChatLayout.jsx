import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaArrowLeft, FaMagnifyingGlass } from 'react-icons/fa6';
import {
  searchWhatsappContacts,
  loadWhatsappChat,
  setSearchQuery,
  selectContact,
  clearSelectedContact,
  appendOptimisticMessage,
  markContactRead,
} from '../../features/whatsappChat/whatsappChatSlice.js';
import { createOutboundWhatsappMessageRequest } from '../../features/whatsappMessages/whatsappMessagesAPI.js';
import { buildApiUrl } from '../../config/apiConfig.js';
import { DEBUG } from '../../config/env.js';
import { selectCompany } from '../../features/user/userSlice.js';
import { getCompanyWhatsappNumber } from '../../features/whatsappChat/whatsappChatAPI.js';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import { toast } from '../../utils/toast.js';
import WhatsappAvatar from './WhatsappAvatar.jsx';
import ContactListItem from './ContactListItem.jsx';
import { ContactListSkeleton, ChatMessagesSkeleton } from './Skeletons.jsx';
import { ChatMessageList } from './ChatMessageList.jsx';
import ChatComposer from './ChatComposer.jsx';
import InChatSearch from './InChatSearch.jsx';
import { formatChatTime } from './chatUtils.jsx';
import '../common/devApiSources.css';
import './whatsapp-chat.css';

const SEARCH_DEBOUNCE_MS = 300;

function mapThunkStatus(status) {
  if (status === 'loading') return 'loading';
  if (status === 'failed') return 'error';
  if (status === 'succeeded') return 'success';
  return 'pending';
}

export default function WhatsappChatLayout() {
  const dispatch = useDispatch();
  const {
    searchQuery,
    searchStatus,
    searchError,
    contacts,
    selectedContactId,
    selectedContact,
    messages,
    chatPage,
    hasMore,
    chatStatus,
    chatError,
    loadingOlder,
  } = useSelector((state) => state.whatsappChat);
  const company = useSelector(selectCompany);
  const ourWhatsappNumber = getCompanyWhatsappNumber(company);

  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatMatch, setInChatMatch] = useState({
    query: '',
    activeId: null,
    total: 0,
    index: 0,
  });
  const [sending, setSending] = useState(false);

  const searchTimeoutRef = useRef(null);
  const listRef = useRef(null);
  const messageRefs = useRef({});
  const shouldStickToBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);

  const runSearch = useCallback(
    (value) => {
      const q = String(value || '').trim();
      dispatch(setSearchQuery(q));
      // Empty query reloads the full list; otherwise search (debounce already applied).
      if (q.length > 0 && q.length < 2) return;
      dispatch(searchWhatsappContacts(q));
    },
    [dispatch]
  );

  useEffect(() => {
    // Load all users on page open.
    dispatch(searchWhatsappContacts(''));
  }, [dispatch]);

  useEffect(
    () => () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    },
    []
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const handleSelectContact = (contact) => {
    shouldStickToBottomRef.current = true;
    setInChatSearchOpen(false);
    dispatch(selectContact(contact));
    dispatch(markContactRead(contact.contactId));
    if (!contact.phone) return;
    dispatch(
      loadWhatsappChat({
        contactId: contact.contactId,
        number: contact.phone,
        page: 1,
        append: false,
      })
    );
  };

  // Scroll to latest after initial load / send
  useEffect(() => {
    if (chatStatus !== 'succeeded' || !listRef.current) return;
    if (!shouldStickToBottomRef.current) {
      // Preserve position when prepending older messages
      const el = listRef.current;
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) el.scrollTop = delta;
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, chatStatus, selectedContactId]);

  // Scroll active in-chat match into view
  useEffect(() => {
    const id = inChatMatch.activeId;
    if (!id) return;
    const el = messageRefs.current[id];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [inChatMatch.activeId]);

  const handleMessagesScroll = () => {
    const el = listRef.current;
    if (!el || !selectedContactId) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldStickToBottomRef.current = nearBottom;

    if (el.scrollTop < 40 && hasMore && !loadingOlder && chatStatus === 'succeeded') {
      prevScrollHeightRef.current = el.scrollHeight;
      shouldStickToBottomRef.current = false;
      dispatch(
        loadWhatsappChat({
          contactId: selectedContactId,
          number: selectedContact?.phone,
          page: chatPage + 1,
          append: true,
        })
      );
    }
  };

  const handleSend = async (text) => {
    if (!selectedContact?.phone) return;
    setSending(true);
    const tempId = `local-${Date.now()}`;
    const optimistic = {
      id: tempId,
      direction: 'outgoing',
      type: 'text',
      message: text,
      timestamp: new Date().toISOString(),
      status: 'not_started',
      unread: false,
    };
    dispatch(appendOptimisticMessage(optimistic));
    shouldStickToBottomRef.current = true;
    try {
      await createOutboundWhatsappMessageRequest({
        number: selectedContact.phone,
        message: text,
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const subtitle = (() => {
    if (!selectedContact) return '';
    if (selectedContact.online) return 'Online';
    if (selectedContact.lastSeen) return `Last seen ${formatChatTime(selectedContact.lastSeen)}`;
    return selectedContact.phone || '';
  })();

  const showChat = Boolean(selectedContactId);

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];

    const contactParams = new URLSearchParams({ limit: '50' });
    const q = String(searchQuery || '').trim();
    if (q) {
      contactParams.set('search', q);
      contactParams.set('searchFields', 'name,phone');
    }

    const sources = [
      {
        key: 'contacts',
        label: 'Contacts / search',
        url: buildApiUrl(`user/get-all?${contactParams.toString()}`),
        status: mapThunkStatus(searchStatus),
        durationMs: null,
        error: searchStatus === 'failed' ? searchError : null,
      },
    ];

    if (selectedContact?.phone) {
      const chatParams = new URLSearchParams({
        number: String(selectedContact.phone),
        page: String(chatPage || 1),
        limit: '50',
        populate: 'whatsapp_message_id',
      });
      sources.push({
        key: 'chat',
        label: 'Chat messages',
        url: buildApiUrl(`chat/get-all?${chatParams.toString()}`),
        status: mapThunkStatus(chatStatus),
        durationMs: null,
        error: chatStatus === 'failed' ? chatError : null,
      });
    }

    sources.push({
      key: 'send',
      label: 'Send message',
      url: buildApiUrl('whatsapp_message/create'),
      status: sending ? 'loading' : 'pending',
      durationMs: null,
      error: null,
    });

    return sources;
  }, [
    searchQuery,
    searchStatus,
    searchError,
    selectedContact?.phone,
    chatPage,
    chatStatus,
    chatError,
    sending,
  ]);

  return (
    <div className="wa-chat-page">
      <div className={`wa-chat-shell${showChat ? ' is-chat-open' : ''}`}>
        {/* Left: search + contacts */}
        <aside className="wa-chat-sidebar">
          <div className="wa-side-header">
            <h5>WhatsApp Chat</h5>
            <p>Search contacts by name or phone</p>
            {DEBUG ? (
              <p className="wa-debug-our-number">
                My number (company.whatsapp_number):{' '}
                <code>{ourWhatsappNumber || 'not set'}</code>
              </p>
            ) : null}
          </div>
          <div className="wa-search-wrap">
            <div className="wa-search-box">
              <FaMagnifyingGlass className="wa-search-icon" aria-hidden />
              <input
                className="wa-search-input"
                type="search"
                placeholder="Search name or number"
                value={localQuery}
                onChange={handleSearchChange}
                aria-label="Search WhatsApp contacts"
              />
              {searchStatus === 'loading' ? <span className="wa-search-spinner" /> : null}
            </div>
          </div>

          <div className="wa-contact-list">
            {searchStatus === 'loading' && contacts.length === 0 ? (
              <ContactListSkeleton />
            ) : null}

            {searchStatus === 'failed' ? (
              <div className="wa-error">
                <div>{searchError || 'Search failed'}</div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => runSearch(localQuery)}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {searchStatus === 'succeeded' && contacts.length === 0 ? (
              <div className="wa-empty">No user found.</div>
            ) : null}

            {searchStatus !== 'failed'
              ? contacts.map((c) => (
                  <ContactListItem
                    key={c.contactId}
                    contact={c}
                    active={c.contactId === selectedContactId}
                    onSelect={handleSelectContact}
                  />
                ))
              : null}
          </div>
        </aside>

        {/* Right: chat */}
        <section className="wa-chat-main">
          {!selectedContact ? (
            <div className="wa-placeholder-main">
              <h4>WhatsApp Chat Search</h4>
              <p>Select a contact from the left to view the conversation.</p>
            </div>
          ) : (
            <>
              <header className="wa-chat-header">
                <button
                  type="button"
                  className="wa-icon-btn wa-back-btn"
                  onClick={() => dispatch(clearSelectedContact())}
                  aria-label="Back to contacts"
                >
                  <FaArrowLeft />
                </button>
                <WhatsappAvatar
                  name={selectedContact.name}
                  src={selectedContact.avatarUrl}
                  online={selectedContact.online}
                  size={40}
                />
                <div className="wa-chat-header-info">
                  <p className="name">{selectedContact.name}</p>
                  <p className="sub">
                    {selectedContact.phone}
                    {subtitle && subtitle !== selectedContact.phone ? ` · ${subtitle}` : ''}
                  </p>
                </div>
                <div className="wa-header-actions">
                  <button
                    type="button"
                    className={`wa-icon-btn${inChatSearchOpen ? ' is-active' : ''}`}
                    onClick={() => setInChatSearchOpen((v) => !v)}
                    title="Search in conversation"
                    aria-label="Search in conversation"
                  >
                    <FaMagnifyingGlass />
                  </button>
                </div>
              </header>

              <InChatSearch
                open={inChatSearchOpen}
                onClose={() => setInChatSearchOpen(false)}
                messages={messages}
                onActiveMatchChange={setInChatMatch}
              />

              {chatStatus === 'loading' && messages.length === 0 ? (
                <ChatMessagesSkeleton />
              ) : null}

              {chatStatus === 'failed' && messages.length === 0 ? (
                <div className="wa-error" style={{ margin: 'auto' }}>
                  <div>{chatError || 'Previous chat not found.'}</div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() =>
                      dispatch(
                        loadWhatsappChat({
                          contactId: selectedContactId,
                          number: selectedContact?.phone,
                          page: 1,
                          append: false,
                        })
                      )
                    }
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {messages.length > 0 ? (
                <ChatMessageList
                  messages={messages}
                  searchQuery={inChatSearchOpen ? inChatMatch.query : ''}
                  activeMatchId={inChatMatch.activeId}
                  messageRefs={messageRefs}
                  listRef={listRef}
                  onScroll={handleMessagesScroll}
                  loadingOlder={loadingOlder}
                  hasMore={hasMore}
                  ourNumber={ourWhatsappNumber}
                />
              ) : null}

              {chatStatus === 'succeeded' && messages.length === 0 ? (
                <div className="wa-empty" style={{ margin: 'auto' }}>
                  No messages yet. Say hello!
                </div>
              ) : null}

              <ChatComposer
                disabled={!selectedContact.phone}
                sending={sending}
                onSend={handleSend}
              />
            </>
          )}
        </section>
      </div>

      {DEBUG ? (
        <DevApiSourcesFooter sources={apiSources} className="wa-api-sources" />
      ) : null}
    </div>
  );
}
