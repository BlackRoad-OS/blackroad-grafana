package auditing

import (
	"context"
	"encoding/json"
	"time"
)

type loggerContextKey struct{}

var (
	DefaultLogger Logger

	contextKey = loggerContextKey{}
)

type Logger interface {
	Log(event Sinkable) error
	Type() string
	Close() error
}

type Sinkable interface {
	json.Marshaler
	KVPairs() []any
	Time() time.Time
}

func FromContext(ctx context.Context) Logger {
	if l := ctx.Value(contextKey); l != nil {
		if logger, ok := l.(Logger); ok {
			return logger
		}
	}

	if DefaultLogger != nil {
		return DefaultLogger
	}

	return &NoopLogger{}
}

func Context(ctx context.Context, logger Logger) context.Context {
	return context.WithValue(ctx, contextKey, logger)
}
