package auditing

import (
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
)

type NoopBackend struct{}

func ProvideNoopBackend() audit.Backend { return &NoopBackend{} }

func (b *NoopBackend) ProcessEvents(k8sEvents ...*auditinternal.Event) bool { return false }

func (NoopBackend) Run(stopCh <-chan struct{}) error { return nil }

func (NoopBackend) Shutdown() {}

func (NoopBackend) String() string { return "" }
