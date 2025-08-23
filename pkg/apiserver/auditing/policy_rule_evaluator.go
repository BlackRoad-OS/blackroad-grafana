package auditing

import (
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"k8s.io/apimachinery/pkg/runtime/schema"
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// PolicyRuleEvaluator alias for easier imports.
type PolicyRuleEvaluator = audit.PolicyRuleEvaluator

// UnionPolicyRuleEvaluator dispatches to the specific PolicyRuleEvaluator depending on the API group+version in the request.
type UnionPolicyRuleEvaluator struct {
	evaluators map[schema.GroupVersion]PolicyRuleEvaluator
}

var _ PolicyRuleEvaluator = &UnionPolicyRuleEvaluator{}

func NewUnionPolicyRuleEvaluator(builders []builder.APIGroupBuilder) *UnionPolicyRuleEvaluator {
	policyRuleEvaluators := make(map[schema.GroupVersion]audit.PolicyRuleEvaluator, 0)

	for _, b := range builders {
		auditor, ok := b.(builder.APIGroupAuditor)
		if !ok {
			continue
		}

		policyRuleEvaluator := auditor.GetPolicyRuleEvaluator()
		if policyRuleEvaluator == nil {
			continue
		}

		for _, gv := range builder.GetGroupVersions(b) {
			if gv.Empty() {
				continue
			}

			policyRuleEvaluators[gv] = policyRuleEvaluator
		}
	}

	return &UnionPolicyRuleEvaluator{policyRuleEvaluators}
}

func (e *UnionPolicyRuleEvaluator) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	evaluator, ok := e.evaluators[schema.GroupVersion{Group: attrs.GetAPIGroup(), Version: attrs.GetAPIVersion()}]
	if !ok {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	return evaluator.EvaluatePolicyRule(attrs)
}

// DefaultGrafanaPolicyRuleEvaluator provides a sane default configuration for audit logging for API group+versions.
// It logs all resource requests (at the `ResponseComplete` stage) except for watch requests.
type defaultGrafanaPolicyRuleEvaluator struct{}

var _ PolicyRuleEvaluator = &defaultGrafanaPolicyRuleEvaluator{}

func NewDefaultGrafanaPolicyRuleEvaluator() defaultGrafanaPolicyRuleEvaluator {
	return defaultGrafanaPolicyRuleEvaluator{}
}

func (defaultGrafanaPolicyRuleEvaluator) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	// Skip non-resource and watch requests otherwise it is too noisy.
	if !attrs.IsResourceRequest() || attrs.GetVerb() == utils.VerbWatch {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	// Skip auditing if the user is part of the privileged group.
	// The loopback client uses this group, so requests initiated in `/api/` would be duplicated.
	if u := attrs.GetUser(); u != nil && slices.Contains(u.GetGroups(), user.SystemPrivilegedGroup) {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	return audit.RequestAuditConfig{
		Level: auditinternal.LevelMetadata,
		OmitStages: []auditinternal.Stage{
			// Only log on StageResponseComplete
			auditinternal.StageRequestReceived,
			auditinternal.StageResponseStarted,
			auditinternal.StagePanic,
		},
		// Keep this not because we use it but because it avoids extra copying/unmarshalling.
		OmitManagedFields: false,
	}
}
