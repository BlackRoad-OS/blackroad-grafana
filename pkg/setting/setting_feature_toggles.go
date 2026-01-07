package setting

import (
	"encoding/json"
	"strconv"

	"gopkg.in/ini.v1"

	"github.com/open-feature/go-sdk/openfeature/memprovider"

	"github.com/grafana/grafana/pkg/util"
)

// Deprecated: should use `featuremgmt.FeatureToggles`
func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	section := iniFile.Section("feature_toggles")
	toggles, err := ReadFeatureTogglesFromInitFile(section)
	if err != nil {
		return err
	}
	// TODO IsFeatureToggleEnabled has been deprecated for 2 years now, we should remove this function completely
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = func(key string) bool {
		toggle, ok := toggles[key]
		if !ok {
			return false
		}

		val, ok := toggle.Variants[toggle.DefaultVariant].(bool)
		return ok && val
	}
	return nil
}

func ReadFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]memprovider.InMemoryFlag, error) {
	featureToggles := make(map[string]memprovider.InMemoryFlag, 10)

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		featureToggles[feature] = memprovider.InMemoryFlag{Key: feature, Variants: map[string]any{"": true}}
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		b, err := ParseFlag(v.Name(), v.Value())
		if err != nil {
			return featureToggles, err
		}

		featureToggles[v.Name()] = b
	}
	return featureToggles, nil
}

func ParseFlag(name, value string) (memprovider.InMemoryFlag, error) {
	if integer, err := strconv.Atoi(value); err == nil {
		return memprovider.InMemoryFlag{Key: name, Variants: map[string]any{"": integer}}, nil
	}

	if float, err := strconv.ParseFloat(value, 64); err == nil {
		return memprovider.InMemoryFlag{Key: name, Variants: map[string]any{"": float}}, nil
	}

	var structure map[string]any
	if err := json.Unmarshal([]byte(value), &structure); err == nil {
		return memprovider.InMemoryFlag{Key: name, Variants: map[string]any{"": structure}}, nil
	}

	if boolean, err := strconv.ParseBool(value); err == nil {
		return memprovider.InMemoryFlag{Key: name, Variants: map[string]any{"": boolean}}, nil
	}

	return memprovider.InMemoryFlag{Key: name, Variants: map[string]any{"": value}}, nil
}
