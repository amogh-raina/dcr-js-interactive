import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import styled from "styled-components";
import { toast } from "react-toastify";
import Button from "../utilComponents/Button";
import { supabase } from "../supabase/client";

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

const GoogleButton = styled(Button)`
  display: inline-flex;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  cursor: pointer;
`;

function authRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

function AuthGate() {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Google sign in failed.");
    }
  };

  return (
    <Page>
      <Panel>
        <Title>DCR-js Sign In</Title>
        <HelpText>
          Continue with your Google account to save and restore modeling work.
        </HelpText>
        <GoogleButton
          disabled={loading}
          onClick={() => void signInWithGoogle()}
          type="button"
        >
          <FcGoogle aria-hidden="true" />
          {loading ? "Opening Google..." : "Continue with Google"}
        </GoogleButton>
      </Panel>
    </Page>
  );
}

export default AuthGate;
