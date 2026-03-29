type LoginViewProps = {
  loading: boolean;
  error: string | null;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginView({ loading, error, password, onPasswordChange, onSubmit }: LoginViewProps) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-copy">
          <p className="eyebrow">Income Hub Control Center</p>
          <h1>Run the earning bot from one clean dashboard.</h1>
          <p>
            Create tasks, review withdrawals, track referral performance, and keep the Telegram bot operating in real time.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="password">Admin password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your admin password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
          />
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Unlock dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
