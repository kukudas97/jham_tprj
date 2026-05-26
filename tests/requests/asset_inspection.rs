use jham::app::App;
use loco_rs::testing::prelude::*;
use serial_test::serial;

#[tokio::test]
#[serial]
async fn can_get_asset_inspections() {
    request::<App, _, _>(|request, _ctx| async move {
        let res = request.get("/api/asset_inspections/").await;
        assert_eq!(res.status_code(), 200);

        // you can assert content like this:
        // assert_eq!(res.text(), "content");
    })
    .await;
}
