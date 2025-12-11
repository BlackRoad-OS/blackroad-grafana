package auditing

type NoopLogger struct{}

func (*NoopLogger) Log(Sinkable) error { return nil }

func (*NoopLogger) Type() string { return "noop" }

func (*NoopLogger) Close() error { return nil }
