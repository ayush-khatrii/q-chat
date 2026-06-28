import { Input } from "../ui/input";

const ChatInput = ({
  value,
  setValue,
}: {
  value: string;
  setValue: (value: string) => void;
}) => {
  return (
    <div>
      <Input
        placeholder="Type a message..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
};

export default ChatInput;
