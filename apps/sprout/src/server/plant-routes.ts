import { Router } from 'express';
import { validatePlantFields } from '../shared/plant.ts';
import { bodyOf, currentUserId, isUuid, sendError } from './http.ts';
import type { Store } from './store.ts';

export function plantRoutes(store: Store): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await store.listPlants());
  });

  router.post('/', async (req, res) => {
    const body = bodyOf(req.body);
    // The browser makes the id, so sending the same new plant twice creates it once.
    if (!isUuid(body['id'])) {
      sendError(res, 400, 'A new plant needs an id in UUID format.');
      return;
    }
    const validation = validatePlantFields(body);
    if (!validation.ok) {
      sendError(res, 400, 'Some fields are not valid.', validation.errors);
      return;
    }
    const plant = await store.createPlant(body['id'], validation.fields, currentUserId(res));
    res.status(201).json(plant);
  });

  router.put('/:id', async (req, res) => {
    const body = bodyOf(req.body);
    const baseVersion = body['baseVersion'];
    if (typeof baseVersion !== 'number' || !Number.isInteger(baseVersion) || baseVersion < 1) {
      sendError(res, 400, 'An edit needs baseVersion: the version the edit started from.');
      return;
    }
    const validation = validatePlantFields(body);
    if (!validation.ok) {
      sendError(res, 400, 'Some fields are not valid.', validation.errors);
      return;
    }
    const result = await store.updatePlant(
      req.params.id,
      baseVersion,
      validation.fields,
      currentUserId(res),
    );
    if (result.status === 'not-found') {
      sendError(res, 404, 'This plant does not exist (any more).');
    } else if (result.status === 'conflict') {
      res.status(409).json({
        error: { message: 'Someone else changed this plant after you started editing.' },
        latest: result.latest,
      });
    } else {
      res.json(result.plant);
    }
  });

  router.delete('/:id', async (req, res) => {
    await store.deletePlant(req.params.id);
    res.status(204).end();
  });

  return router;
}
