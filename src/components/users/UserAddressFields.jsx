import { useMemo } from 'react';
import SearchableSelect from '../common/SearchableSelect.jsx';
import {
  PAKISTAN_STATES,
  USER_COUNTRY_OPTIONS,
  getPakistanCities,
  getStateForCity,
  withCurrentOption,
} from '../../constants/pakistanLocations.js';

const toOptions = (items) => items.map((item) => ({ value: item, label: item }));

const UserAddressFields = ({ form, setForm, idPrefix, disabled = false }) => {
  const countryOptions = useMemo(
    () => toOptions(withCurrentOption(USER_COUNTRY_OPTIONS, form.country)),
    [form.country]
  );
  const stateOptions = useMemo(
    () => toOptions(withCurrentOption(PAKISTAN_STATES, form.state)),
    [form.state]
  );
  const cityOptions = useMemo(() => {
    const cities = withCurrentOption(getPakistanCities(form.state), form.city);
    return cities.map((city) => ({
      value: city,
      label: city,
      subLabel: form.state ? undefined : getStateForCity(city) || undefined,
    }));
  }, [form.state, form.city]);

  const handleCountryChange = (country) => {
    setForm((prev) => ({ ...prev, country }));
  };

  const handleStateChange = (state) => {
    setForm((prev) => {
      const cities = getPakistanCities(state);
      const cityStillValid = cities.some(
        (item) => item.toLowerCase() === String(prev.city || '').toLowerCase()
      );
      return { ...prev, state, city: cityStillValid ? prev.city : '' };
    });
  };

  const handleCityChange = (city) => {
    setForm((prev) => ({
      ...prev,
      city,
      state: getStateForCity(city) || prev.state,
    }));
  };

  return (
    <div className="row g-3">
      <div className="col-12">
        <label className="user-form-label d-block" htmlFor={`${idPrefix}-address`}>
          Address
        </label>
        <input
          id={`${idPrefix}-address`}
          className="form-control user-form-control"
          value={form.address}
          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          disabled={disabled}
        />
      </div>
      <div className="col-md-6">
        <label className="user-form-label d-block" htmlFor={`${idPrefix}-area`}>
          Area
        </label>
        <input
          id={`${idPrefix}-area`}
          className="form-control user-form-control"
          value={form.area}
          onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
          disabled={disabled}
        />
      </div>
      <div className="col-md-6">
        <label className="user-form-label d-block" htmlFor={`${idPrefix}-country`}>
          Country
        </label>
        <SearchableSelect
          id={`${idPrefix}-country`}
          className="user-form-control"
          options={countryOptions}
          value={form.country}
          placeholder="Select country"
          searchPlaceholder="Search country…"
          disabled={disabled}
          onChange={handleCountryChange}
        />
      </div>
      <div className="col-md-6">
        <label className="user-form-label d-block" htmlFor={`${idPrefix}-state`}>
          State
        </label>
        <SearchableSelect
          id={`${idPrefix}-state`}
          className="user-form-control"
          options={stateOptions}
          value={form.state}
          placeholder="Select state"
          searchPlaceholder="Search state…"
          disabled={disabled}
          onChange={handleStateChange}
        />
      </div>
      <div className="col-md-6">
        <label className="user-form-label d-block" htmlFor={`${idPrefix}-city`}>
          City
        </label>
        <SearchableSelect
          id={`${idPrefix}-city`}
          className="user-form-control"
          options={cityOptions}
          value={form.city}
          placeholder="Select city"
          searchPlaceholder="Search city…"
          disabled={disabled}
          onChange={handleCityChange}
        />
      </div>
      <div className="col-md-6">
        <label className="user-form-label d-block" htmlFor={`${idPrefix}-zip`}>
          Zip Code
        </label>
        <input
          id={`${idPrefix}-zip`}
          className="form-control user-form-control"
          value={form.zip_code}
          onChange={(e) => setForm((prev) => ({ ...prev, zip_code: e.target.value }))}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default UserAddressFields;
