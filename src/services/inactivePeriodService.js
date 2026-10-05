import { randomUUID } from "node:crypto";

export function getStartOfUtcDay(date_value = new Date()) {
  const date = new Date(date_value);

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
}

export function getPreviousUtcDay(date_value = new Date()) {
  return new Date(getStartOfUtcDay(date_value).getTime() - 24 * 60 * 60 * 1000);
}

export function isDateInInactivePeriods(date_value, periods = []) {
  const date = new Date(date_value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return periods.some((period) => {
    const start_date = new Date(period.start_date);
    const end_date = period.end_date ? new Date(period.end_date) : null;

    return start_date <= date && (!end_date || end_date >= date);
  });
}

async function openInactivePeriod({
  transaction,
  model_name,
  foreign_key,
  foreign_uuid,
  start_date = new Date(),
}) {
  const model = transaction[model_name];
  const normalized_start_date = getStartOfUtcDay(start_date);

  await model.updateMany({
    where: {
      [foreign_key]: foreign_uuid,
      deleted_at: null,
      start_date: {
        gte: normalized_start_date,
      },
    },
    data: {
      deleted_at: new Date(),
    },
  });

  const active_period = await model.findFirst({
    where: {
      [foreign_key]: foreign_uuid,
      deleted_at: null,
      end_date: null,
    },
    select: {
      uuid: true,
      start_date: true,
    },
  });

  if (active_period) {
    return active_period;
  }

  return model.create({
    data: {
      uuid: randomUUID(),
      [foreign_key]: foreign_uuid,
      start_date: normalized_start_date,
      end_date: null,
    },
    select: {
      uuid: true,
      start_date: true,
      end_date: true,
    },
  });
}

async function closeInactivePeriod({
  transaction,
  model_name,
  foreign_key,
  foreign_uuid,
  active_date = new Date(),
}) {
  const model = transaction[model_name];
  const normalized_active_date = getStartOfUtcDay(active_date);
  const end_date = getPreviousUtcDay(normalized_active_date);

  await model.updateMany({
    where: {
      [foreign_key]: foreign_uuid,
      deleted_at: null,
      start_date: {
        gte: normalized_active_date,
      },
    },
    data: {
      deleted_at: new Date(),
    },
  });

  return model.updateMany({
    where: {
      [foreign_key]: foreign_uuid,
      deleted_at: null,
      end_date: null,
      start_date: {
        lt: normalized_active_date,
      },
    },
    data: {
      end_date,
    },
  });
}

export async function createOutletInsanKuPreActivePeriod(
  transaction,
  uuid_outlet_insanku,
  active_date,
) {
  if (!active_date) {
    return null;
  }

  const start_date = new Date(Date.UTC(1970, 0, 1));
  const end_date = getPreviousUtcDay(active_date);

  if (end_date < start_date) {
    return null;
  }

  return transaction.tbl_outlet_insanku_inactive_period.create({
    data: {
      uuid: randomUUID(),
      uuid_outlet_insanku,
      start_date,
      end_date,
    },
  });
}

export function openInsanKuInactivePeriod(transaction, uuid_insanku, start_date) {
  return openInactivePeriod({
    transaction,
    model_name: "tbl_insanku_inactive_period",
    foreign_key: "uuid_insanku",
    foreign_uuid: uuid_insanku,
    start_date,
  });
}

export function closeInsanKuInactivePeriod(transaction, uuid_insanku, active_date) {
  return closeInactivePeriod({
    transaction,
    model_name: "tbl_insanku_inactive_period",
    foreign_key: "uuid_insanku",
    foreign_uuid: uuid_insanku,
    active_date,
  });
}

export function openOutletInsanKuInactivePeriod(
  transaction,
  uuid_outlet_insanku,
  start_date,
) {
  return openInactivePeriod({
    transaction,
    model_name: "tbl_outlet_insanku_inactive_period",
    foreign_key: "uuid_outlet_insanku",
    foreign_uuid: uuid_outlet_insanku,
    start_date,
  });
}

export function closeOutletInsanKuInactivePeriod(
  transaction,
  uuid_outlet_insanku,
  active_date,
) {
  return closeInactivePeriod({
    transaction,
    model_name: "tbl_outlet_insanku_inactive_period",
    foreign_key: "uuid_outlet_insanku",
    foreign_uuid: uuid_outlet_insanku,
    active_date,
  });
}
