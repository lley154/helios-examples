const BuyProduct = ({ onBuyProduct, orderInfo } : any) => {

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onBuyProduct()
    } 

    return (

        <form onSubmit={onSubmit}>
            <div>
                <p><b>Buy Product </b></p>
                <p>Order ID &nbsp; &nbsp;{orderInfo.order_id}</p>
                <p>Order Total &nbsp; &nbsp;${orderInfo.total}</p>
                <p>ADA Amount Estimate &nbsp; &nbsp;{orderInfo.ada_amount}</p>
            </div>
            <input type='submit' value='Send Ada'/>
        </form>

    )
}

export default BuyProduct