import { useState } from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import Button from "../utilComponents/Button";
import {
  allowedEmailDomains,
  isAllowedUniversityEmail,
  supabase,
} from "../supabase/client";

const Page = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 2rem;
  background: #f4f4f4;
`;

const Panel = styled.section`
  width: min(28rem, 100%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  padding: 1.5rem;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.45rem;
`;

const HelpText = styled.p`
  margin: 0;
  color: #555;
  line-height: 1.4;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
`;

const Input = styled.input`
  box-sizing: border-box;
  width: 100%;
  padding: 0.7rem;
  border: 1px solid #aaa;
  border-radius: 4px;
  font: inherit;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (mode: "sign-in" | "sign-up") => {
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    if (!isAllowedUniversityEmail(email)) {
      toast.error(
        `Use an approved university email: ${allowedEmailDomains.join(", ")}`,
      );
      return;
    }

    try {
      setLoading(true);
      const credentials = {
        email: email.trim().toLowerCase(),
        password,
      };
      const { error } =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword(credentials)
          : await supabase.auth.signUp(credentials);

      if (error) {
        throw error;
      }

      toast.success(
        mode === "sign-in"
          ? "Signed in."
          : "Account created. Check your email if confirmation is enabled.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <Panel>
        <Title>DCR-js Sign In</Title>
        <HelpText>
          Use a university email ending in {allowedEmailDomains.join(", ")}.
        </HelpText>
        <Field>
          Email
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </Field>
        <Field>
          Password
          <Input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </Field>
        <Actions>
          <Button disabled={loading} onClick={() => submit("sign-in")} type="button">
            Sign in
          </Button>
          <Button disabled={loading} onClick={() => submit("sign-up")} type="button">
            Create account
          </Button>
        </Actions>
      </Panel>
    </Page>
  );
}

export default AuthGate;
