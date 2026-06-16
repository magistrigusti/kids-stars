import { SignIn } from '@clerk/nextjs';
import AuthTelegramAccess from '@/app/components/AuthTelegramAccess/AuthTelegramAccess';

export function generateStaticParams() {
  return [
    {
      login: [],
    },
  ];
}

export default function LoginPage() {
  return (
    <main style={authPageStyle}>
      <div style={authShellStyle}>
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/register"
          forceRedirectUrl="/training/brain"
        />
        <AuthTelegramAccess />
      </div>
    </main>
  );
}

const authPageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'var(--auth-page-bg, #f6fbff)',
} satisfies React.CSSProperties;

const authShellStyle = {
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  alignItems: 'center',
} satisfies React.CSSProperties;
