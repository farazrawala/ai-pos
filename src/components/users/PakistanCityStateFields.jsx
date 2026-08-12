import { useMemo } from 'react';
import SearchableSelect from '../common/SearchableSelect.jsx';
import { getPakistanAreas } from '../../constants/pakistanAreas.js';
import {
  PAKISTAN_STATES,
  getPakistanCities,
  getStateForCity,
  withCurrentOption,
} from '../../constants/pakistanLocations.js';

const toOptions = (items) => items.map((item) => ({ value: item, label: item }));

const isAreaValidForCity = (city, area) => {
  const areas = getPakistanAreas(city);
  const value = String(area || '').trim();
  if (!value) return true;
  return areas.some((item) => item.toLowerCase() === value.toLowerCase());
};

const PakistanCityStateFields = ({
  city = '',
  state = '',
  area = '',
  includeArea = false,
  onChange,
  idPrefix = 'customer',
  disabled = false,
  className = 'mb-3',
  showToggle = false,
  showFields = true,
  onShowFieldsChange,
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
  const areaOptions = useMemo(() => {
    if (!String(city || '').trim()) return [];
    return toOptions(withCurrentOption(getPakistanAreas(city), area));
  }, [city, area]);

  const handleStateChange = (nextState) => {
    const cities = getPakistanCities(nextState);
    const cityStillValid = cities.some(
      (item) => item.toLowerCase() === String(city || '').toLowerCase()
    );
    const nextCity = cityStillValid ? city : '';
    const nextArea = isAreaValidForCity(nextCity, area) ? area : '';
    onChange?.({ state: nextState, city: nextCity, area: nextArea });
  };

  const handleCityChange = (nextCity) => {
    const nextArea = isAreaValidForCity(nextCity, area) ? area : '';
    onChange?.({
      city: nextCity,
      state: getStateForCity(nextCity) || state,
      area: nextArea,
    });
  };

  const handleAreaChange = (nextArea) => {
    onChange?.({ city, state, area: nextArea });
  };

  const columnClass = includeArea ? 'col-4' : 'col-md-6';

  const fields = (
    <div className={`row g-3 ${className}`.trim()}>
      <div className={columnClass}>
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
      <div className={columnClass}>
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
      {includeArea ? (
        <div className={columnClass}>
          <label className="form-label" htmlFor={`${idPrefix}_area`}>
            Area
          </label>
          <SearchableSelect
            id={`${idPrefix}_area`}
            options={areaOptions}
            value={area}
            placeholder={city ? 'Select area' : 'Select city first'}
            searchPlaceholder="Search area…"
            disabled={disabled || !city}
            onChange={handleAreaChange}
          />
        </div>
      ) : null}
    </div>
  );

  if (!showToggle) {
    return fields;
  }

  const toggleId = `${idPrefix}_location_toggle`;

  return (
    <>
      <div className="d-flex justify-content-end mb-2">
        <div className="form-check form-switch mb-0">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id={toggleId}
            checked={showFields}
            onChange={(e) => onShowFieldsChange?.(e.target.checked)}
            disabled={disabled}
          />
          <label className="form-check-label" htmlFor={toggleId}>
            Address
          </label>
        </div>
      </div>
      {showFields ? fields : null}
    </>
  );
};

export default PakistanCityStateFields;
