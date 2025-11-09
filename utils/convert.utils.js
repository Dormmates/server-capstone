export const convertDates = (dates) => {
  return dates.map(({ date, time }) => {
    const [hours, minutes] = time.split(":").map(Number);
    const combinedDate = new Date(date);
    combinedDate.setHours(hours || 0, minutes || 0, 0, 0);

    return { datetime: combinedDate };
  });
};
