package auditing

type NoopLogger struct{}

func (l *NoopLogger) Log(event Event) error {
	return nil
}
