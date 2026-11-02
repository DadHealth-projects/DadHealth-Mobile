function rowsFor(payload) {
  return [payload?.old, payload?.new].filter((row) => row && typeof row === 'object');
}

function isCurrentFeedPost(row, circleId) {
  return circleId ? row.circle_id === circleId : row.circle_id === null;
}

export function isCommunityFeedChangeRelevant(payload, { circleId, visiblePostIds, userId }) {
  const rows = rowsFor(payload);
  const eventType = payload?.eventType;

  if (payload?.table === 'posts') {
    if (eventType === 'DELETE') {
      return rows.some((row) => typeof row.id === 'string' && visiblePostIds.has(row.id));
    }
    if (eventType === 'UPDATE' && rows.some((row) => typeof row.id === 'string' && visiblePostIds.has(row.id))) {
      return true;
    }
    return rows.some((row) => isCurrentFeedPost(row, circleId));
  }

  if (payload?.table === 'user_circles') {
    return Boolean(userId && rows.some((row) => row.user_id === userId))
      || (eventType === 'DELETE' && !rows.some((row) => typeof row.user_id === 'string'));
  }

  if (!['likes', 'comments', 'saved_posts'].includes(payload?.table)) return false;
  if (payload.table === 'saved_posts' && (!userId || rows.some((row) => typeof row.user_id === 'string' && row.user_id !== userId))) return false;
  // Comment DELETE payloads may contain only the comment primary key, without
  // post_id. A refresh is needed to keep reply counts correct in that case.
  if (eventType === 'DELETE' && !rows.some((row) => typeof row.post_id === 'string')) return true;
  return rows.some((row) => typeof row.post_id === 'string' && visiblePostIds.has(row.post_id));
}

export function isCommunityCommentLikeRelevant(payload, visibleCommentIds) {
  if (payload?.table !== 'comment_likes') return false;
  return rowsFor(payload).some((row) => typeof row.comment_id === 'string' && visibleCommentIds.has(row.comment_id));
}

export function isCommunityCommentChangeRelevant(payload, postId, visibleCommentIds) {
  if (payload?.table !== 'comments') return false;
  const rows = rowsFor(payload);
  if (rows.some((row) => row.post_id === postId)) return true;
  return payload?.eventType === 'DELETE'
    && rows.some((row) => typeof row.id === 'string' && visibleCommentIds.has(row.id));
}

export function isCommunityPostActivityChangeRelevant(payload, postId, visibleRowIds, userId) {
  if (!['likes', 'saved_posts'].includes(payload?.table)) return false;
  const rows = rowsFor(payload);
  if (payload?.table === 'saved_posts' && (!userId || rows.some((row) => typeof row.user_id === 'string' && row.user_id !== userId))) return false;
  if (rows.some((row) => row.post_id === postId)) return true;
  return payload?.eventType === 'DELETE'
    && rows.some((row) => typeof row.id === 'string' && visibleRowIds.has(row.id));
}

export function buildCommunityInFilters(ids, column, maxValues = 100) {
  const filters = [];
  for (let index = 0; index < ids.length; index += maxValues) {
    const values = ids.slice(index, index + maxValues);
    if (values.length) filters.push(`${column}=in.(${values.join(',')})`);
  }
  return filters;
}

export function createRealtimeRefreshScheduler(run, delayMs = 200) {
  let timer = null;
  let running = false;
  let pending = false;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      if (disposed) return;
      if (running) {
        pending = true;
        return;
      }
      running = true;
      try {
        await run();
      } finally {
        running = false;
        if (pending) {
          pending = false;
          schedule();
        }
      }
    }, delayMs);
  };

  return {
    schedule,
    dispose() {
      disposed = true;
      pending = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

export function createRefreshDeduper() {
  const inFlight = new Map();

  return (key, run) => {
    const existing = inFlight.get(key);
    if (existing) {
      existing.rerun = run;
      return existing.promise;
    }

    const flight = { promise: null, rerun: null };
    const execute = async () => {
      let nextRun = run;
      while (nextRun) {
        flight.rerun = null;
        await nextRun();
        nextRun = flight.rerun;
      }
    };
    flight.promise = execute().finally(() => {
      if (inFlight.get(key) === flight) inFlight.delete(key);
    });
    inFlight.set(key, flight);
    return flight.promise;
  };
}
