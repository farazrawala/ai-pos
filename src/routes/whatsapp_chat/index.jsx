import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import WhatsappChatLayout from '../../components/whatsappChat/WhatsappChatLayout.jsx';

const WhatsappChatPage = () => {
  useRequireModuleAccess('whatsapp-messages');

  return <WhatsappChatLayout />;
};

export default WhatsappChatPage;
