import MessageList from './MessageList';
import Composer from './Composer';

export default function ChatWorkspace({ conversation, onSend, isSending }) {
  return (
    <main className="chat-workspace">
      <MessageList conversation={conversation} />
      <Composer onSend={onSend} loading={isSending} />
    </main>
  );
}
