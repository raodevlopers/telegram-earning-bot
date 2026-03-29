type LoginViewProps = {
  loading: boolean;
  error: string | null;
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginView({ loading, error, username, password, onUsernameChange, onPasswordChange, onSubmit }: LoginViewProps) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-copy">
          <p className="eyebrow">Income Hub Control Center</p>
          <h1>Operate tasks, balances, and withdrawals from one secure console.</h1>
          <p>
            This admin panel is protected with Firebase Authentication and connected to the live Firestore wallet ledger behind your Telegram earning bot.
          </p>

          <div className="login-meta-grid">
            <div>
              <span>Security</span>
              <strong>Firebase email and password auth</strong>
            </div>
            <div>
              <span>Live data</span>
              <strong>Firestore-backed operational dashboard</strong>
            </div>
            <div>
              <span>Hosting</span>
              <strong>Optimized for Firebase Hosting</strong>
            </div>
          </div>
        </div>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="username">
            Admin username
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </label>

          <p className="helper-copy">Use the configured admin username and your Firebase Auth password to unlock the dashboard.</p>

          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              placeholder="Enter your admin password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Unlock dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
