import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCompanyById,
  getCompanyFromApiBody,
} from '../company/companyAPI.js';
import {
  selectAuthUser,
  selectCompany,
  selectCompanyId,
  setCompany,
} from '../user/userSlice.js';
import { usePrintLayout } from './PrintLayoutContext.jsx';
import { mapCompanyRecordToLayoutPatch } from './mapCompanyToLayout.js';

/**
 * Loads company profile from Redux cache + GET /company/get/:id
 * and hydrates print layout settings (company name, contact, logo, etc.).
 */
export function useHydrateCompanyFromDb() {
  const dispatch = useDispatch();
  const companyId = useSelector(selectCompanyId);
  const authCompany = useSelector(selectCompany);
  const authUser = useSelector(selectAuthUser);
  const { patchSettings } = usePrintLayout();
  const companyRef = useRef(null);
  const authCompanyRef = useRef(authCompany);
  const authUserRef = useRef(authUser);
  const hydratedRef = useRef(false);

  authCompanyRef.current = authCompany;
  authUserRef.current = authUser;

  const applyCompanyRecord = useCallback(
    (company) => {
      if (!company) return;
      companyRef.current = company;
      const patch = mapCompanyRecordToLayoutPatch(company, authUserRef.current);
      if (patch) patchSettings(patch);
    },
    [patchSettings]
  );

  const rehydrateCompany = useCallback(() => {
    if (companyRef.current) {
      applyCompanyRecord(companyRef.current);
      return;
    }
    if (authCompanyRef.current) applyCompanyRecord(authCompanyRef.current);
  }, [applyCompanyRecord]);

  // Apply session company once (profile fields).
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!authCompany) return;
    applyCompanyRecord(authCompany);
    hydratedRef.current = true;
  }, [authCompany, applyCompanyRecord]);

  // Fetch once per companyId — avoid depending on authCompany (causes reload loops).
  useEffect(() => {
    if (!companyId) return undefined;

    let cancelled = false;

    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) return;
        const merged = { ...(authCompanyRef.current || {}), ...fetched };
        applyCompanyRecord(merged);
        hydratedRef.current = true;
        dispatch(setCompany(merged));
      })
      .catch(() => {
        // Keep Redux/local cache values on fetch failure.
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, applyCompanyRecord, dispatch]);

  return { rehydrateCompany };
}
