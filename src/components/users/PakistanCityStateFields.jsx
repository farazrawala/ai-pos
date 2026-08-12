import { useMemo } from 'react';
import SearchableSelect from '../common/SearchableSelect.jsx';
import {
  PAKISTAN_STATES,
  getPakistanCities,
  getStateForCity,
  withCurrentOption,
} from '../../constants/pakistanLocations.js';

const toOptions = (items) => items.map((item) => ({ value: item, label: item }));

const PakistanCityStateFields = ({
  city = '',
  state = '',
  onChange,
  idPrefix = 'customer',
  disabled = false,
  className = 'mb-3',
}) => {
  const stateOptions = useMemo(() => toOptions(withCurrentOption(PAKISTAN_STATES, state)), [state]);
  const cityOptions = useMemo(() => {
    const cities = withCurrentOption(getPakistanCities(state), city);
    return cities.map((item) => ({
      value: item,
      label: item,
      subLabel: state ? undefined : getStateForCity(item) || undefined,
    }));
  }, [state, city]);

  const handleStateChange = (nextState) => {
    const cities = getPakistanCities(nextState);
    const cityStillValid = cities.some(
      (item) => item.toLowerCase() === String(city || '').toLowerCase()
    );
    onChange?.({ state: nextState, city: cityStillValid ? city : '' });
  };

  const handleCityChange = (nextCity) => {
    onChange?.({
      city: nextCity,
      state: getStateForCity(nextCity) || state,
    });
  };

  return (
    <div className={`row g-3 ${className}`.trim()}>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${idPrefix}_state`}>
          State
        </label>
        <SearchableSelect
          id={`${idPrefix}_state`}
          options={stateOptions}
          value={state}
          placeholder="Select state"
          searchPlaceholder="Search state…"
          disabled={disabled}
          onChange={handleStateChange}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${idPrefix}_city`}>
          City
        </label>
        <SearchableSelect
          id={`${idPrefix}_city`}
          options={cityOptions}
          value={city}
          placeholder="Select city"
          searchPlaceholder="Search city…"
          disabled={disabled}
          onChange={handleCityChange}
        />
      </div>
    </div>
  );
};

export default PakistanCityStateFields;
