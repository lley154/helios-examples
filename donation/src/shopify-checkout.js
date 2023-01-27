<script>
    Shopify.Checkout.OrderStatus.addContentBox(
    '<h2 style="color:red;">Pay To Complete Your Order</h2>',
    '<a href="#" id="paynow">Pay Now In Ada</a>'
    );
    var urlStr = "https://3000-venomous-decision-kd0ey1.us1.demeter.run/";
    var url = new URL(urlStr);
    var params = url.searchParams;
    var orderId = Shopify.checkout.order_id
    params.append("id", orderId);

    function updatePayNow () {
      document.getElementById("paynow").href=url 
    }

    function updateOrderNum () {
      document.querySelector("body > div > div > div > main > div.step > div.step__sections > div:nth-child(1) > div > div > span").innerHTML=orderId
    }

    document.addEventListener("DOMContentLoaded", function() {
      updatePayNow()
    });
    document.addEventListener("DOMContentLoaded", function() {
      updateOrderNum()
    });
</script>