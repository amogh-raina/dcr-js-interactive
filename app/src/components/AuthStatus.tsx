import styled from "styled-components";
import Button from "../utilComponents/Button";

const Bar = styled.div`
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
`;

const Email = styled.span`
  max-width: 18rem;
  overflow: hidden;
  color: #333;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SignOutButton = styled(Button)`
  padding: 0.35rem 0.55rem;
  font-size: 0.85rem;
`;

interface AuthStatusProps {
  email: string;
  onSignOut: () => void;
}

function AuthStatus({ email, onSignOut }: AuthStatusProps) {
  return (
    <Bar>
      <Email>{email}</Email>
      <SignOutButton onClick={onSignOut} type="button">
        Sign out
      </SignOutButton>
    </Bar>
  );
}

export default AuthStatus;
