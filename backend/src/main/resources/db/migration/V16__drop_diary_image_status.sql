-- diary.diary_image_status copied diary_image.status but nothing read it: every read and the
-- retry check go to diary_image itself, and the diary row lock is what serializes requests.
alter table diary drop column diary_image_status;
