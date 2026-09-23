import { FastifyBaseLogger } from 'fastify';
import {
    dhis2Service,
    isStaleDhis2EntityReferenceError,
    TrackedEntityInstance,
} from '../../services/dhis2.service';

export async function refreshSiteDhis2ReferencesFromDhis2(
    healthCenter: string,
    houseNumber: string,
    signal: AbortSignal
): Promise<TrackedEntityInstance> {
    await dhis2Service.invalidateOrgUnitCache(healthCenter);
    await dhis2Service.invalidateTeiCache(houseNumber);
    const tei = await dhis2Service.searchTrackedEntityInstances(healthCenter, houseNumber, {
        signal,
        bypassCache: true,
    });
    if (!tei) {
        throw new Error(
            `No tracked entity instance found in DHIS2 for health center "${healthCenter}" and house number "${houseNumber}" after DHIS2 reference refresh`
        );
    }
    return tei;
}

export async function runWithTeiConflictRetry<T>(
    site: { id: number; healthCenter: string; houseNumber: string },
    setTei: (tei: TrackedEntityInstance) => void,
    operation: () => Promise<T>,
    log: FastifyBaseLogger,
    signal: AbortSignal
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (!isStaleDhis2EntityReferenceError(error)) {
            throw error;
        }
        log.warn(
            `DHIS2 rejected stale entity reference for site ${site.id}; refreshing org unit and TEI from DHIS2 and retrying`
        );
        const freshTei = await refreshSiteDhis2ReferencesFromDhis2(
            site.healthCenter,
            site.houseNumber,
            signal
        );
        setTei(freshTei);
        return operation();
    }
}
